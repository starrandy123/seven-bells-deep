# Drowned City: the second cast, W15, to the same bar as the first: "a real life figure and animals". Each body lofted from its species' real proportions, in units of total length.
# In the water: head toward -y, spine on x = 0, z = 0, real metres. On land (goat, crab, giant_crab): head toward -y, feet on z = 0. Static meshes: the life shaders bend them.
import math

import numpy as np

from meshkit import Mesh, Perlin3, TAU, fan, grid, hexc, join, lathe, mix, sphere, sstep, tube
from gen_nature import unit
from gen_creatures import RAD, Body, disc_at, eye_at, fin, jag, mirrored, rows_with


def solid(c):
    c = hexc(c)
    return lambda u, cc, s: np.broadcast_to(c, u.shape + (3,)).copy()


def whisker(p, d, L, col):
    """One thin triangle: a vibrissa."""
    p, d = np.asarray(p, np.float64), unit(d)
    side = unit(np.cross(d, [0.1, 0.2, 1.0])) * L * 0.012
    m = Mesh(np.array([p - side, p + side, p + d * L]), [[0, 1, 2]], S=False)
    m.C[..., :3] = col
    return m


def tooth(p, d, L, w, col):
    """A needle: three faces round a point."""
    p, d = np.asarray(p, np.float64), unit(d)
    e1, e2 = unit(np.cross(d, [0.3, 0.1, 1.0])), None
    e2 = unit(np.cross(d, e1))
    ring = np.array([p + (math.cos(a) * e1 + math.sin(a) * e2) * w for a in (0.0, 2.09, 4.19)])
    m = fan(ring, p + d * L, S=False)
    if np.dot(m.face_normals()[0], ring[0] - p) < 0:
        m = m.flip()
    m.C[..., :3] = col
    return m


def hammerhead():
    """Sphyrna mokarran, 4.4 m: the cephalofoil a flat wing 28% of the body across, nearly straight along the front with a notch at the middle, an eye at each tip, the mouth a small crescent well behind it;
    a very tall sickle first dorsal, deep falcate pectorals, a long upper tail. Bronze grey above, white below."""
    L = 4.4
    k = dict(
        t=[0.0, 0.03, 0.06, 0.09, 0.13, 0.19, 0.26, 0.33, 0.40, 0.48, 0.56, 0.63, 0.70, 0.76, 0.80, 0.84],
        top=[0.012, 0.018, 0.024, 0.034, 0.05, 0.068, 0.08, 0.086, 0.084, 0.074, 0.06, 0.046, 0.033, 0.024, 0.019, 0.014],
        bot=[-0.008, -0.012, -0.016, -0.026, -0.044, -0.064, -0.08, -0.088, -0.084, -0.072, -0.056, -0.04, -0.026, -0.015, -0.01, -0.003],
        hw=[0.03, 0.034, 0.036, 0.04, 0.054, 0.068, 0.078, 0.082, 0.076, 0.066, 0.052, 0.038, 0.026, 0.019, 0.013, 0.004],
        zw=[0.001, 0.001, 0.002, 0.001, 0.0, -0.002, -0.003, -0.003, -0.002, 0.0, 0.002, 0.003, 0.004, 0.006, 0.007, 0.006],
        n=[2.2] * 16,
    )
    b = Body(L, k)
    wob = jag(231, 0.7)
    pn = Perlin3(232)

    def water(t):
        return (float(np.interp(t, [0.0, 0.2, 0.45, 0.6, 0.8, 0.84], [112, 104, 110, 90, 78, 70])) + 2.0 * wob(t)) * RAD

    def skin(t, phi, side, P, fphi, ft):
        w = np.array([water(x) for x in ft])
        n = pn.fbm(P[..., 0] * 2.0, P[..., 1] * 2.0, P[..., 2] * 2.0, 3)
        back = mix(hexc('#5a5a4c'), hexc('#8e8c78'), sstep(26 * RAD, 100 * RAD, phi + 0.14 * n)[..., None]) * (0.94 + 0.14 * n[..., None])
        return np.where((fphi < w)[:, None, None], back, hexc('#f0efe6') * (0.97 + 0.03 * n[..., None]))

    ts = np.concatenate([[0.004, 0.02, 0.04, 0.06], np.linspace(0.08, 0.3, 18), np.linspace(0.32, 0.84, 22)])
    parts = [b.loft(ts, rows_with(water, 8, 6), skin)]
    GREY = hexc('#6a6856')
    Ptop = lambda t: b.point(np.array(t), np.array(0.0))
    Yt = lambda t: b.y0 + t * L
    grey = solid('#6a6856')

    def top_under(u, c, side):
        a = mix(np.broadcast_to(hexc('#5f5e4e'), u.shape + (3,)).copy(), hexc('#7d7b68'), sstep(0.2, 0.9, c)[..., None])
        return np.where(side[..., None] > 0, np.broadcast_to(hexc('#ecebe2'), a.shape), a)

    # the hammer: one wing either side, front edge nearly square to the body, the tip's corner carrying the eye
    wing = fin((0.0, Yt(0.0) - 0.05, 0.03), [0, 1, 0], [1, 0, 0], [(0.05, 0.0), (0.0, 0.1), (0.0, 0.3), (0.03, 0.5), (0.1, 0.62)], [(0.56, 0.0), (0.42, 0.12), (0.34, 0.3), (0.3, 0.5), (0.22, 0.62)], 0.13, nu=8, nc=3, colfn=top_under, tip=0.42)
    parts += [wing, mirrored(wing)]
    # the first dorsal, tall and sickled; the small second dorsal, the anal
    O = np.array([0.0, Yt(0.3), float(Ptop(0.3)[2]) - 0.07])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.18, 0.2), (0.36, 0.46), (0.52, 0.7), (0.72, 0.92)], [(0.74, 0.0), (0.66, 0.16), (0.6, 0.38), (0.62, 0.66), (0.72, 0.92)], 0.1, nu=9, nc=3, colfn=grey))
    O = np.array([0.0, Yt(0.655), float(Ptop(0.655)[2]) - 0.03])
    parts.append(fin(O, [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.1, 0.1), (0.2, 0.2)], [(0.3, 0.0), (0.26, 0.1), (0.2, 0.2)], 0.03, nu=4, nc=2, colfn=grey))
    pa = b.point(np.array(0.665), np.array(math.pi))
    parts.append(fin((0.0, pa[1], pa[2] + 0.03), [0, 1, 0], [0, 0, -1], [(0.0, 0.0), (0.1, 0.1), (0.2, 0.18)], [(0.28, 0.0), (0.25, 0.1), (0.2, 0.18)], 0.03, nu=4, nc=2, colfn=grey))
    # the pectorals: long, falcate, swept
    down = unit([0.84, 0.0, -0.54])
    pf = fin((0.09, Yt(0.235), -0.13), [0, 1, 0], down, [(0.0, 0.0), (0.2, 0.2), (0.44, 0.48), (0.66, 0.74), (0.86, 0.94)], [(0.42, 0.0), (0.5, 0.18), (0.62, 0.44), (0.76, 0.72), (0.86, 0.94)], 0.07, nu=9, nc=3, colfn=top_under)
    pv = fin(b.point(np.array(0.56), np.array(135 * RAD)) + np.array([-0.02, 0, 0.03]), [0, 1, 0], unit([0.72, 0.0, -0.69]), [(0.0, 0.0), (0.1, 0.1), (0.22, 0.22)], [(0.3, 0.0), (0.3, 0.12), (0.22, 0.22)], 0.03, nu=4, nc=2, colfn=grey)
    parts += [pf, mirrored(pf), pv, mirrored(pv)]
    # the tail: the upper lobe long, a notch near its tip
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Yt(0.77), 0.055), (Yt(0.84), 0.12), (Yt(0.91), 0.36), (Yt(0.965), 0.64), (Yt(1.0), 0.82)], [(Yt(0.875), 0.08), (Yt(0.915), 0.14), (Yt(0.955), 0.27), (Yt(0.985), 0.56), (Yt(1.0), 0.82)], 0.05, nu=10, nc=3, colfn=grey))
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Yt(0.8), -0.008), (Yt(0.84), -0.08), (Yt(0.875), -0.23), (Yt(0.905), -0.4)], [(Yt(0.875), 0.08), (Yt(0.88), -0.06), (Yt(0.895), -0.22), (Yt(0.905), -0.4)], 0.05, nu=7, nc=3, colfn=grey))
    # gills, mouth, eyes
    for side in (-1, 1):
        for t in (0.205, 0.218, 0.231, 0.244, 0.257):
            s = np.linspace(0.0, 1.0, 5)
            parts.append(b.strip(t + 0.004 * (s - 0.5), (84 + 26 * s) * RAD, side, 0.01 + 0.01 * np.sin(s * math.pi), hexc('#3a382e'), lift=0.003))
        s = np.linspace(0.0, 1.0, 9)
        parts.append(b.strip(0.1 + 0.03 * s ** 1.2, (179 - 42 * s ** 0.8) * RAD, side, 0.02 - 0.01 * s, hexc('#2a2622'), lift=0.004))
        e = eye_at(np.array([side * 0.615, Yt(0.0) + 0.1, 0.03]), np.array([side * 1.0, 0.0, 0.0]), 0.024, hexc('#060708'), iris=hexc('#a89868'), lid=hexc('#6a6856'), pupil=0.6)
        parts.append(e)
    return join(parts)


def moray():
    """Gymnothorax javanicus, 2.2 m: a deep laterally flattened body with no pectorals, a long muscular head that rises behind the eyes, the jaw a long dark gape it never quite shuts, one soft fin running the length of its back and round the tail.
    Tan, leopard-blotched in near black, paler at the throat."""
    L = 2.2
    k = dict(
        t=[0.0, 0.012, 0.03, 0.06, 0.09, 0.12, 0.16, 0.22, 0.35, 0.5, 0.65, 0.8, 0.92, 1.0],
        top=[0.002, 0.009, 0.017, 0.027, 0.037, 0.043, 0.047, 0.05, 0.052, 0.05, 0.044, 0.034, 0.02, 0.002],
        bot=[-0.002, -0.012, -0.022, -0.034, -0.042, -0.046, -0.046, -0.046, -0.046, -0.044, -0.04, -0.03, -0.018, -0.002],
        hw=[0.0005, 0.008, 0.016, 0.022, 0.027, 0.03, 0.031, 0.032, 0.031, 0.028, 0.023, 0.016, 0.009, 0.0005],
        n=[2.2] * 14,
    )
    b = Body(L, k)
    pn = Perlin3(241)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 6.0, P[..., 1] * 6.0 + 3.0, P[..., 2] * 6.0, 2)
        col = mix(hexc('#a8925e'), hexc('#2c2416'), sstep(-0.06, 0.3, n)[..., None])              # blotches no sharper than the mesh rows can hold
        return mix(col, hexc('#c8bc90'), (sstep(2.1, 2.7, phi) * 0.8)[..., None])

    ts = np.concatenate([[0.003, 0.012, 0.024, 0.04], np.linspace(0.055, 0.2, 10), np.linspace(0.23, 0.985, 24)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 8), skin)]
    Y = lambda t: b.y0 + t * L
    on_top = lambda t: float(b.point(np.array(t), np.array(0.0))[2])
    on_bot = lambda t: float(b.point(np.array(t), np.array(math.pi))[2])

    def finc(u, c, s):
        n = pn.fbm(u * 19.0, c * 3.0, u * 0.0, 2)
        return mix(mix(np.broadcast_to(hexc('#8a7648'), u.shape + (3,)).copy(), hexc('#241c12'), sstep(0.0, 0.2, n)[..., None]), hexc('#e0d8b0'), (sstep(0.6, 1.0, c) * 0.5)[..., None])

    ta = [0.13, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 0.995]
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(t), on_top(t) + 0.002 + 0.024 * L * (1.0 - t * 0.3) * float(sstep(0.13, 0.2, t))) for t in ta], [(Y(t), on_top(t) - 0.004) for t in ta], 0.012, nu=14, nc=2, colfn=lambda u, c, s: finc(u, 1.0 - c, s), tip=0.6))
    tb = [0.52, 0.65, 0.78, 0.88, 0.95, 0.995]
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(t), on_bot(t) - 0.002 - 0.02 * L) for t in tb], [(Y(t), on_bot(t) + 0.004) for t in tb], 0.012, nu=8, nc=2, colfn=lambda u, c, s: finc(u, 1.0 - c, s), tip=0.6))
    # the gape, the teeth, the small round eye over it, the gill a small dark hole
    white = hexc('#ece6d4')
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 12)
        tt = 0.004 + 0.112 * s
        ph = (112 - 22 * s + 10.0 * np.sin(s * math.pi)) * RAD
        parts.append(b.strip(tt, ph, side, 0.03 * np.sin(np.minimum(s * 1.1, 1.0) * math.pi) ** 0.6 + 0.006, hexc('#14090a'), lift=0.0015))
        for i, q in enumerate(np.linspace(0.08, 0.86, 7)):
            t = 0.004 + 0.112 * q
            p = b.point(np.array(t), np.array((112 - 22 * q + 10.0 * math.sin(q * math.pi) - 7.0) * RAD), side)
            parts.append(tooth(p, [0.0, 0.03, -1.0], 0.022, 0.006, white))
        parts.append(b.eye(0.072, 66 * RAD, side, 0.012, hexc('#070808'), iris=hexc('#b8a040'), lid=hexc('#6a5a3a'), segs=8, pupil=0.55))
        parts.append(disc_at(b.point(np.array(0.165), np.array(100 * RAD), side), b.normal(np.array(0.165), np.array(100 * RAD), side), 0.016, hexc('#12100a'), lift=0.002))
    return join(parts)


def anglerfish():
    """Ceratias, the deep-sea devil, 0.9 m: a black globe that is mostly mouth, the gape turned up, long glassy needle teeth, tiny eyes, warty skin, thread fins, and over all of it the rod and its glowing bait."""
    L = 0.9
    k = dict(
        t=[0.0, 0.02, 0.06, 0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.78, 0.84],
        top=[0.02, 0.09, 0.18, 0.26, 0.315, 0.335, 0.3, 0.23, 0.14, 0.07, 0.03],
        bot=[-0.05, -0.12, -0.2, -0.26, -0.29, -0.29, -0.26, -0.19, -0.11, -0.06, -0.03],
        hw=[0.03, 0.1, 0.17, 0.22, 0.25, 0.25, 0.22, 0.16, 0.09, 0.05, 0.015],
        n=[2.0] * 11,
    )
    b = Body(L, k)
    pn = Perlin3(251)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 18.0, P[..., 1] * 18.0, P[..., 2] * 18.0, 3)
        return mix(hexc('#17110e'), hexc('#35261c'), sstep(-0.1, 0.4, n)[..., None])

    ts = np.concatenate([[0.004, 0.02, 0.04], np.linspace(0.06, 0.84, 18)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 10), skin)]
    glass = hexc('#d8dcd0')
    mouth = hexc('#070304')

    def jaw(s, up):
        """The gape's edge, s 0..1 from the chin's front round to its corner."""
        t = 0.012 + 0.22 * s
        ph = (104 - 34 * s) * RAD if up else (112 - 18 * s) * RAD
        return t, ph

    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 12)
        tt = 0.012 + 0.22 * s
        ph = (108 - 26 * s) * RAD
        parts.append(b.strip(tt, ph, side, 0.15 * np.sin(np.minimum(s * 1.08, 1.0) * math.pi) ** 0.55 + 0.01, mouth, lift=0.002))
        for i, q in enumerate(np.linspace(0.04, 0.9, 8)):
            t, a = jaw(float(q), True)
            parts.append(tooth(b.point(np.array(t), np.array(a), side), [side * 0.1, 0.05, -1.0], 0.08 + 0.05 * math.sin(q * math.pi), 0.007, glass))
            t, a = jaw(float(q) + 0.03, False)
            parts.append(tooth(b.point(np.array(t), np.array(a + 0.34), side), [side * 0.1, -0.05, 1.0], 0.1 + 0.06 * math.sin(q * math.pi), 0.007, glass))
        parts.append(b.eye(0.15, 56 * RAD, side, 0.014, hexc('#0a0c0e'), iris=hexc('#5a6a6a'), lid=hexc('#20160f'), segs=8, pupil=0.6))
    rs = np.random.RandomState(252)
    for i in range(26):
        t = rs.uniform(0.1, 0.72)
        a = rs.uniform(0.1, 2.9)
        parts.append(b.dome(t, a, 1.0 if i % 2 else -1.0, 0.012, 0.012, hexc('#2c2018'), seg=4))
    # the rod, from the top of the head, arching out over the gape; the bait
    top = b.point(np.array(0.14), np.array(0.0))
    pts = np.array([top + np.array([0, 0.0, -0.01]), top + np.array([0.0, -0.04, 0.12]), top + np.array([0.0, -0.17, 0.2]), top + np.array([0.0, -0.31, 0.15]), top + np.array([0.0, -0.36, 0.05])])
    parts.append(tube(pts, [0.018, 0.014, 0.012, 0.009, 0.007], sides=4, cap_end=False).tinted(hexc('#3a2c22')))
    bait = sphere(pts[-1] + np.array([0, 0, -0.03]), (0.035, 0.035, 0.05), seg=6, rings=4)
    bait.tint(np.array([0.32, 1.0, 0.82]))
    parts.append(bait)
    parts.append(tube([pts[-1] + np.array([0, 0, -0.08]), pts[-1] + np.array([0.0, 0.03, -0.17])], [0.006, 0.002], sides=3).tinted(np.array([0.2, 0.7, 0.6])))
    # thread fins, a soft fan of a tail
    fc = solid('#2a1e16')
    Y = lambda t: b.y0 + t * L
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(0.82), 0.02), (Y(0.92), 0.1), (Y(1.0), 0.16)], [(Y(0.84), 0.0), (Y(1.0), 0.03), (Y(1.0), 0.16)], 0.006, nu=4, nc=2, colfn=fc, tip=0.6))
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(0.82), -0.02), (Y(0.92), -0.1), (Y(1.0), -0.16)], [(Y(0.84), 0.0), (Y(1.0), -0.03), (Y(1.0), -0.16)], 0.006, nu=4, nc=2, colfn=fc, tip=0.6))
    p = b.point(np.array(0.48), np.array(100 * RAD), 1.0)
    pf = fin(p, unit([0.1, 1.0, 0.0]), unit([0.8, 0.3, -0.5]), [(0.0, 0.0), (0.03, 0.08), (0.05, 0.15)], [(0.09, 0.0), (0.12, 0.08), (0.05, 0.15)], 0.005, nu=3, nc=2, colfn=fc, tip=0.6)
    parts += [pf, mirrored(pf)]
    return join(parts)


def leg_mesh(pts, radii, col_a, col_b, band=0.0, sides=5):
    """A jointed limb: a tube through its joints, swollen a little at each, banded along its length if asked."""
    m = tube(pts, radii, sides=sides, S=True, cap_end=True)
    C = m.corners()
    p0 = np.asarray(pts[0], np.float64)
    d = np.linalg.norm(C - p0, axis=-1)
    if band > 0.0:
        m.C[..., :3] = mix(col_a, col_b, sstep(-0.2, 0.3, np.sin(d * band))[..., None])
    else:
        m.C[..., :3] = mix(col_a, col_b, np.clip(d / max(np.linalg.norm(np.asarray(pts[-1], np.float64) - p0), 1e-6), 0, 1)[..., None])
    return m


def claw(base, d, L, col, tip):
    """A pincer: a swollen palm and two tapering fingers."""
    base, d = np.asarray(base, np.float64), unit(d)
    up = unit(np.cross(d, np.cross([0, 0, 1.0], d)) + np.array([0, 0, 0.01]))
    palm = tube([base, base + d * L * 0.45], [L * 0.16, L * 0.22], sides=6, cap_end=False)
    palm.C[..., :3] = col
    a = base + d * L * 0.45 + up * L * 0.08
    b = base + d * L * 0.45 - up * L * 0.08
    f1 = tube([a, a + d * L * 0.3 + up * L * 0.05, a + d * L * 0.55 - up * L * 0.03], [L * 0.1, L * 0.07, L * 0.012], sides=4)
    f2 = tube([b, b + d * L * 0.28 - up * L * 0.05, b + d * L * 0.5 + up * L * 0.04], [L * 0.08, L * 0.05, L * 0.012], sides=4)
    f1.C[..., :3] = mix(col, tip, np.clip((f1.corners()[..., 2] * 0 + 0.8), 0, 1)[..., None])
    f2.C[..., :3] = mix(col, tip, np.clip((f2.corners()[..., 2] * 0 + 0.8), 0, 1)[..., None])
    return join([palm, f1, f2])


def carapace(L, keys, skin, h, ts, rows=8):
    """A crab's shell: a low loft along y, its belly flat, set at height h."""
    b = Body(L, keys, y_nose=-L * 0.5)
    m = b.loft(ts, lambda t: np.linspace(0, math.pi, rows), skin)
    return b, m.moved(0.0, 0.0, h)


def giant_crab():
    """Macrocheira kaempferi, the giant spider crab, 3.4 m across the legs: a pear-shaped knobbed shell no longer than a forearm, two long thin clawed arms, eight stilts each of three long joints, orange flecked with white. It stands high on them and picks its way."""
    L = 0.46
    h = 0.92
    k = dict(t=[0.0, 0.08, 0.2, 0.4, 0.62, 0.84, 1.0], top=[0.02, 0.08, 0.15, 0.21, 0.24, 0.17, 0.02], bot=[-0.02, -0.06, -0.1, -0.13, -0.14, -0.1, -0.02], hw=[0.04, 0.12, 0.2, 0.3, 0.38, 0.32, 0.04], n=[2.0] * 7)
    pn = Perlin3(261)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 14.0, P[..., 1] * 14.0, P[..., 2] * 14.0, 3)
        return mix(hexc('#b4542a'), hexc('#e8c8a0'), sstep(0.1, 0.4, n)[..., None])

    b, shell = carapace(L, k, skin, h, np.linspace(0.015, 0.985, 10))
    parts = [shell]
    rs = np.random.RandomState(262)
    for i in range(12):
        d = b.dome(rs.uniform(0.2, 0.9), rs.uniform(0.1, 1.2), 1.0 if i % 2 else -1.0, 0.016, 0.026, hexc('#c8703c'), seg=4)
        parts.append(d.moved(0.0, 0.0, h))
    or_a, or_b = hexc('#c0602e'), hexc('#efe0c4')
    for side in (-1, 1):
        for i, (yb, a, span) in enumerate(((-0.02, 62.0, 1.62), (0.05, 86.0, 1.7), (0.11, 110.0, 1.6), (0.16, 136.0, 1.42))):
            r = math.radians(a)
            out = np.array([side * math.sin(r), -math.cos(r), 0.0])
            base = np.array([side * 0.15, yb, h - 0.03])
            knee = base + out * span * 0.3 + np.array([0, 0, 0.3])
            ankle = base + out * span * 0.72 + np.array([0, 0, -0.14])
            tip = base + out * span * 1.0 + np.array([0, 0, -h + 0.03])
            parts.append(leg_mesh([base, knee, ankle, tip], [0.03, 0.026, 0.018, 0.005], or_a, or_b, band=9.0))
        # the arm, thin and long, the claw held out in front
        base = np.array([side * 0.08, -0.15, h - 0.02])
        el = base + np.array([side * 0.34, -0.26, 0.2])
        wr = base + np.array([side * 0.46, -0.72, 0.08])
        parts.append(leg_mesh([base, el, wr], [0.03, 0.026, 0.024], or_a, or_b, band=9.0))
        parts.append(claw(wr, [side * 0.1, -1.0, -0.1], 0.32, or_a, hexc('#f4ecd8')))
        # the eyes, on short stalks
        p = np.array([side * 0.04, -0.22, h + 0.03])
        parts.append(tube([p, p + np.array([side * 0.02, -0.03, 0.03])], [0.008, 0.006], sides=3, cap_end=False).tinted(or_a))
        e = sphere(p + np.array([side * 0.02, -0.03, 0.04]), (0.013, 0.013, 0.013), seg=5, rings=3)
        e.tint(hexc('#0a0a0c'))
        parts.append(e)
    return join(parts)


def crab():
    """Carcinus, a green shore crab, 0.2 m wide on an open beach: a broad toothed shell, two strong claws held in front, eight jointed legs out to the sides, eyes on stalks. Olive above, orange at the joints."""
    L = 0.14
    h = 0.075
    k = dict(t=[0.0, 0.1, 0.3, 0.55, 0.8, 1.0], top=[0.05, 0.2, 0.3, 0.32, 0.24, 0.03], bot=[-0.02, -0.08, -0.12, -0.13, -0.1, -0.03], hw=[0.3, 0.5, 0.66, 0.68, 0.46, 0.08], n=[2.4] * 6)

    def skin(t, phi, side, P, fphi, ft):
        return mix(hexc('#3f4a26'), hexc('#7a7a3a'), sstep(0.3, 1.5, phi)[..., None])

    b, shell = carapace(L, k, skin, h, np.linspace(0.01, 0.99, 7), rows=6)
    parts = [shell]
    col, joint = hexc('#4a5230'), hexc('#c07030')
    for side in (-1, 1):
        for i, a in enumerate((70.0, 94.0, 118.0, 142.0)):
            r = math.radians(a)
            out = np.array([side * math.sin(r), -math.cos(r), 0.0])
            base = np.array([side * 0.08, -0.03 + i * 0.02, h - 0.01])
            parts.append(leg_mesh([base, base + out * 0.06 + np.array([0, 0, 0.022]), base + out * 0.14 + np.array([0, 0, -0.01]), base + out * 0.17 + np.array([0, 0, -h + 0.005])], [0.009, 0.008, 0.006, 0.002], col, joint, sides=3))
        base = np.array([side * 0.07, -0.05, h - 0.01])
        wr = base + np.array([side * 0.05, -0.06, 0.0])
        parts.append(leg_mesh([base, wr], [0.011, 0.012], col, joint, sides=4))
        parts.append(claw(wr, [-side * 0.25, -1.0, 0.0], 0.085, col, joint))
        p = np.array([side * 0.018, -0.068, h + 0.018])
        e = sphere(p, (0.006, 0.006, 0.006), seg=4, rings=2)
        e.tint(hexc('#0a0a0c'))
        parts.append(e)
    return join(parts)


def narwhal():
    """Monodon monoceros, 4.4 m and the tusk 2.1 m more: a smooth spindle with a blunt rounded head and no beak at all, no dorsal fin but a low ridge along the back, short upcurled flippers, flukes with a convex rear edge. The tusk is a left upper tooth, grown in a left-handed spiral. Mottled black over white."""
    L = 4.4
    k = dict(
        t=[0.0, 0.01, 0.03, 0.06, 0.1, 0.16, 0.24, 0.33, 0.44, 0.55, 0.66, 0.76, 0.84, 0.9, 0.93],
        top=[0.004, 0.03, 0.055, 0.07, 0.082, 0.095, 0.106, 0.112, 0.108, 0.096, 0.078, 0.056, 0.036, 0.024, 0.014],
        bot=[-0.004, -0.02, -0.04, -0.056, -0.07, -0.088, -0.104, -0.112, -0.11, -0.1, -0.08, -0.056, -0.034, -0.022, -0.011],
        hw=[0.002, 0.03, 0.05, 0.064, 0.076, 0.09, 0.1, 0.106, 0.102, 0.09, 0.072, 0.05, 0.03, 0.016, 0.012],
        n=[2.0] * 15,
    )
    b = Body(L, k)
    pn = Perlin3(271)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 1.4, P[..., 1] * 1.4, P[..., 2] * 1.4, 2)
        m_ = pn.fbm(P[..., 0] * 2.6 + 4.0, P[..., 1] * 2.6, P[..., 2] * 2.6, 2)
        col = mix(hexc('#2a3034'), hexc('#c4cac8'), sstep(0.9, 1.9, phi + 0.5 * n)[..., None])
        col = mix(col, hexc('#20262a'), (sstep(0.0, 0.3, m_) * sstep(0.7, 1.2, phi) * sstep(2.4, 1.9, phi))[..., None])
        return mix(col, hexc('#eceee8'), sstep(1.9, 2.6, phi)[..., None])

    ts = np.concatenate([[0.003, 0.01, 0.02, 0.035, 0.055], np.linspace(0.08, 0.3, 12), np.linspace(0.32, 0.93, 26)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 13), skin)]
    DK = hexc('#2a3034')
    for t in np.linspace(0.48, 0.72, 7):                                 # the low ridge where a dolphin has a fin
        parts.append(b.dome(float(t), 0.0, 1.0, 0.05, 0.03, DK, seg=5))
    Y = lambda t: b.y0 + t * L
    fp = b.point(np.array(0.22), np.array(122 * RAD), 1.0)
    flip = fin(fp + np.array([-0.02, 0, 0.0]), unit([0.1, 1.0, -0.1]), unit([0.86, 0.1, -0.5]), [(0.0, 0.0), (0.05, 0.14), (0.12, 0.3), (0.26, 0.46)], [(0.42, 0.0), (0.42, 0.16), (0.38, 0.32), (0.26, 0.46)], 0.05, nu=7, nc=3, colfn=solid('#3a4044'))
    parts += [flip, mirrored(flip)]
    y = Y(0.9)
    fl = fin((0.0, y, 0.0), [0, 1, 0], [1, 0, 0], [(0.0, 0.0), (0.06, 0.2), (0.16, 0.42), (0.34, 0.6), (0.5, 0.66)], [(0.46, 0.0), (0.52, 0.2), (0.58, 0.38), (0.56, 0.54), (0.5, 0.66)], 0.06, nu=9, nc=3, colfn=solid('#2e3438'))
    parts += [fl, mirrored(fl)]
    # the tusk: out of the left of the upper jaw, a long straight taper, the spiral a groove that winds to the left
    p0 = b.point(np.array(0.012), np.array(70 * RAD), 1.0) + np.array([0.0, 0.05, 0.02])
    n = 18
    tp = np.array([p0 + np.array([0.0, -2.1 * i / (n - 1.0), 0.05 * i / (n - 1.0)]) for i in range(n)])
    m = tube(tp, np.linspace(0.05, 0.008, n), sides=6, cap_end=True)
    C = m.corners()
    u = (p0[1] - C[..., 1]) / 2.1
    a = np.arctan2(C[..., 2] - p0[2] - 0.05 * u, C[..., 0] - p0[0])
    m.C[..., :3] = mix(hexc('#a89874'), hexc('#efe6cc'), sstep(-0.5, 0.2, np.sin(a * 2.0 - u * 62.0))[..., None])
    parts.append(m)
    # the eye, set low; the mouth, short; the blowhole
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 8)
        parts.append(b.strip(0.012 + 0.05 * s, (116 - 12 * s) * RAD, side, 0.012 - 0.005 * s, hexc('#1a1e22'), lift=0.002))
        parts.append(b.eye(0.073, 98 * RAD, side, 0.014, hexc('#090a0c'), iris=hexc('#3a2e22'), lid=hexc('#3a4044'), pupil=0.68))
    s = np.linspace(-1.0, 1.0, 5)
    parts.append(b.strip(0.095 + 0.004 * s * s, np.abs(s) * 6.0 * RAD, 1.0, 0.018, hexc('#14181a'), lift=0.002))
    parts.append(b.strip(0.095 + 0.004 * s * s, np.abs(s) * 6.0 * RAD, -1.0, 0.018, hexc('#14181a'), lift=0.002))
    return join(parts)


def seal():
    """Leptonychotes weddellii, the Weddell seal of the ice, 2.7 m: a heavy spindle tapering to a small round head that looks too small for it, a short muzzle with a cat's whiskers, big dark eyes, short foreflippers set low, the two hind flippers trailing as a fan. Blue-grey, dappled silver, paler under."""
    L = 2.7
    k = dict(
        t=[0.0, 0.01, 0.03, 0.06, 0.09, 0.13, 0.18, 0.24, 0.32, 0.42, 0.54, 0.66, 0.76, 0.84, 0.9],
        top=[0.008, 0.02, 0.034, 0.047, 0.056, 0.062, 0.074, 0.096, 0.118, 0.13, 0.128, 0.11, 0.082, 0.052, 0.03],
        bot=[-0.006, -0.014, -0.024, -0.036, -0.046, -0.056, -0.072, -0.096, -0.12, -0.134, -0.13, -0.112, -0.084, -0.052, -0.03],
        hw=[0.006, 0.018, 0.03, 0.042, 0.052, 0.058, 0.07, 0.092, 0.114, 0.126, 0.122, 0.102, 0.074, 0.046, 0.028],
        n=[2.0] * 15,
    )
    b = Body(L, k)
    pn = Perlin3(281)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 1.6, P[..., 1] * 1.6, P[..., 2] * 1.6, 2)
        m_ = pn.fbm(P[..., 0] * 3.0 + 4.0, P[..., 1] * 3.0, P[..., 2] * 3.0, 2)
        back = mix(hexc('#2c333a'), hexc('#5a666e'), sstep(0.6, 1.9, phi + 0.5 * n)[..., None])
        back = mix(back, hexc('#a4b0b4'), (sstep(0.0, 0.3, m_) * sstep(2.6, 2.0, phi))[..., None])     # the silver dapples
        return mix(back, hexc('#c4ccce'), sstep(1.9, 2.7, phi + 0.4 * n)[..., None])

    ts = np.concatenate([[0.003, 0.01, 0.02, 0.035, 0.05, 0.07, 0.09, 0.115, 0.14, 0.165, 0.19], np.linspace(0.22, 0.9, 20)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 11), skin)]
    Y = lambda t: b.y0 + t * L
    fc = lambda u, c, s: mix(np.broadcast_to(hexc('#4a545c'), u.shape + (3,)).copy(), hexc('#20262c'), sstep(0.4, 1.0, u)[..., None])
    fp = b.point(np.array(0.27), np.array(128 * RAD), 1.0)
    flip = fin(fp, unit([0.1, 1.0, -0.1]), unit([0.82, 0.1, -0.56]), [(0.0, 0.0), (0.03, 0.14), (0.06, 0.27), (0.12, 0.36)], [(0.3, 0.0), (0.29, 0.14), (0.25, 0.28), (0.12, 0.36)], 0.05, nu=6, nc=3, colfn=fc)
    parts += [flip, mirrored(flip)]
    # the hind flippers: two broad fans held together, trailing, long outer digits and a notch between
    for side in (-1, 1):
        O = (side * 0.035, Y(0.885), 0.0)
        f = fin(O, [0, 1, 0], [side * 0.55, 0.0, 0.84], [(0.0, -0.1), (0.1, -0.06), (0.26, 0.0)], [(0.36, 0.14), (0.34, 0.18), (0.26, 0.26)], 0.03, nu=5, nc=3, colfn=fc, tip=0.4)
        g = fin(O, [0, 1, 0], [side * 0.55, 0.0, -0.84], [(0.0, -0.1), (0.1, -0.06), (0.26, 0.0)], [(0.36, 0.14), (0.34, 0.18), (0.26, 0.26)], 0.03, nu=5, nc=3, colfn=fc, tip=0.4)
        parts += [f.tinted(hexc('#343c44')), g.tinted(hexc('#343c44'))]
    white = hexc('#d8d4c8')
    for side in (-1, 1):
        parts.append(b.eye(0.075, 66 * RAD, side, 0.024, hexc('#060708'), iris=hexc('#160e0a'), lid=hexc('#2a3036'), pupil=0.82))
        p = b.point(np.array(0.006), np.array(70 * RAD), side)
        parts.append(disc_at(p, b.normal(np.array(0.006), np.array(70 * RAD), side), 0.007, hexc('#0a0a0c'), segs=5, lift=0.002))
        s = np.linspace(0.0, 1.0, 6)
        parts.append(b.strip(0.006 + 0.034 * s, (118 - 16 * s) * RAD, side, 0.006, hexc('#14181c'), lift=0.0015))
        for i in range(5):
            q = b.point(np.array(0.014 + 0.005 * i), np.array((86 + 7 * i) * RAD), side)
            parts.append(whisker(q, [side * 1.0, 0.3, -0.2 - 0.1 * i], 0.11, white))
    return join(parts)


def sea_otter():
    """Enhydra lutris, 1.25 m, floating on its back as they do: a long dense body, the head round and pale with a dark nose and a cat's whiskers, small ears, forepaws folded on the chest, broad webbed hind feet held up out of the water, a flat tail for a rudder. Dark brown fur, frosted at the head."""
    L = 1.25
    k = dict(
        t=[0.0, 0.012, 0.04, 0.08, 0.12, 0.16, 0.2, 0.26, 0.34, 0.46, 0.58, 0.68, 0.74],
        top=[0.012, 0.03, 0.06, 0.082, 0.09, 0.082, 0.088, 0.11, 0.128, 0.138, 0.128, 0.098, 0.05],
        bot=[-0.01, -0.024, -0.05, -0.068, -0.074, -0.078, -0.09, -0.116, -0.134, -0.142, -0.13, -0.098, -0.05],
        hw=[0.01, 0.03, 0.058, 0.078, 0.084, 0.08, 0.09, 0.114, 0.13, 0.136, 0.124, 0.09, 0.044],
        n=[2.0] * 13,
    )
    b = Body(L, k)
    pn = Perlin3(291)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 11.0, P[..., 1] * 11.0, P[..., 2] * 11.0, 3)
        col = mix(hexc('#3a2a1e'), hexc('#5a4430'), sstep(-0.2, 0.3, n)[..., None])
        return mix(col, hexc('#c8b8a0'), (sstep(0.26, 0.09, t + 0.05 * n) * (0.8 + 0.2 * sstep(-0.2, 0.3, n)))[..., None])

    ts = np.concatenate([[0.004, 0.012, 0.024, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18], np.linspace(0.21, 0.74, 14)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 11), skin)]
    Y = lambda t: b.y0 + t * L
    DK, FUR, PAD = hexc('#2a1e16'), hexc('#46342a'), hexc('#1a1412')
    # the tail: long, flat, thick
    parts.append(fin((0.0, Y(0.72), 0.0), [0, 1, 0], [1, 0, 0], [(0.0, 0.0), (0.1, 0.04), (0.2, 0.05), (0.33, 0.012)], [(0.1, 0.09), (0.2, 0.09), (0.3, 0.06), (0.33, 0.012)], 0.06, nu=5, nc=2, colfn=solid('#3a2a1e'), tip=0.5))
    parts.append(mirrored(fin((0.0, Y(0.72), 0.0), [0, 1, 0], [1, 0, 0], [(0.0, 0.0), (0.1, 0.04), (0.2, 0.05), (0.33, 0.012)], [(0.1, 0.09), (0.2, 0.09), (0.3, 0.06), (0.33, 0.012)], 0.06, nu=5, nc=2, colfn=solid('#3a2a1e'), tip=0.5)))
    for side in (-1, 1):
        # the forelimb, folded across the chest, the paw a soft mitt
        p = b.point(np.array(0.27), np.array(152 * RAD), side, extra=-0.02)
        q = b.point(np.array(0.235), np.array(164 * RAD), side, extra=0.03)
        r = b.point(np.array(0.205), np.array(172 * RAD), side, extra=0.035)
        parts.append(leg_mesh([p, q, r], [0.03, 0.028, 0.022], FUR, DK, sides=5))
        pw = sphere(r, (0.03, 0.036, 0.02), seg=5, rings=3)
        pw.tint(PAD)
        parts.append(pw)
        # the hind foot: a broad webbed paddle on a short leg
        p = b.point(np.array(0.66), np.array(146 * RAD), side, extra=-0.02)
        q = p + np.array([side * 0.035, 0.05, -0.1])
        parts.append(leg_mesh([p, q], [0.048, 0.036], FUR, DK, sides=5))
        foot = fin(q + np.array([0.0, 0.0, -0.01]), unit([side * 1.0, 0.08, 0.0]), unit([0.0, -0.25, -1.0]), [(-0.05, 0.0), (-0.075, 0.1), (-0.07, 0.2)], [(0.06, 0.0), (0.09, 0.1), (0.08, 0.2)], 0.024, nu=5, nc=2, colfn=solid('#20160f'), tip=0.5)
        parts.append(foot)
        # the head's marks
        parts.append(b.eye(0.064, 58 * RAD, side, 0.012, hexc('#060708'), iris=hexc('#0a0806'), lid=hexc('#a89880'), segs=8, pupil=0.8))
        parts.append(b.dome(0.115, 42 * RAD, side, 0.012, 0.018, hexc('#7a6a58'), seg=4))
        for i in range(4):
            q = b.point(np.array(0.022 + 0.006 * i), np.array((84 + 8 * i) * RAD), side)
            parts.append(whisker(q, [side * 1.0, 0.25, -0.15 - 0.12 * i], 0.08, hexc('#e8e0d0')))
    n0 = b.point(np.array(0.006), np.array(30 * RAD), 1.0)
    nose = sphere(np.array([0.0, n0[1] - 0.002, n0[2] - 0.002]), (0.018, 0.012, 0.012), seg=5, rings=3)
    nose.tint(hexc('#0e0c0c'))
    parts.append(nose)
    # she floats belly up: turned over her long axis
    return join(parts).rot('y', math.pi)


def gull():
    """Larus argentatus, a herring gull in flight: a white body, a strong yellow bill with its red spot, long narrow wings 1.4 m across, grey above, white beneath, the tips black with white mirrors, a white square tail. The wings are the mesh's widest part, so the look can beat them by |x|."""
    L = 0.58
    k = dict(t=[0.0, 0.04, 0.09, 0.14, 0.2, 0.3, 0.42, 0.56, 0.68, 0.76], top=[0.002, 0.012, 0.03, 0.062, 0.078, 0.092, 0.092, 0.07, 0.04, 0.016], bot=[-0.002, -0.012, -0.022, -0.05, -0.07, -0.098, -0.104, -0.08, -0.042, -0.014], hw=[0.001, 0.01, 0.022, 0.05, 0.068, 0.09, 0.094, 0.07, 0.04, 0.02], n=[2.0] * 10)
    b = Body(L, k)

    def skin(t, phi, side, P, fphi, ft):
        col = mix(hexc('#f0f0ea'), hexc('#d8dcdc'), sstep(0.3, 0.7, t)[..., None] * sstep(1.2, 0.3, phi)[..., None])
        col = mix(hexc('#e8bc3a'), col, sstep(0.085, 0.1, t)[..., None])
        return col

    ts = np.array([0.004, 0.02, 0.045, 0.07, 0.09, 0.105, 0.13, 0.16, 0.2, 0.26, 0.34, 0.44, 0.54, 0.64, 0.75])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 7), skin)]
    Y = lambda t: b.y0 + t * L

    def wingc(u, c, side):
        top = mix(np.broadcast_to(hexc('#8e99a2'), u.shape + (3,)).copy(), hexc('#f0f0ea'), sstep(0.86, 1.0, c)[..., None])
        out = np.where(side[..., None] > 0, np.broadcast_to(hexc('#f2f2ec'), top.shape), top)
        out = mix(out, hexc('#101214'), sstep(0.76, 0.8, u)[..., None])
        return mix(out, hexc('#f4f4ee'), (sstep(0.86, 0.88, u) * sstep(0.93, 0.91, u) * sstep(0.2, 0.3, c) * sstep(0.7, 0.6, c))[..., None])

    root = b.point(np.array(0.27), np.array(60 * RAD), 1.0)
    w = fin(root + np.array([-0.012, -0.03, 0.0]), unit([0.0, 1.0, 0.0]), unit([1.0, 0.0, 0.04]), [(0.0, 0.0), (0.0, 0.2), (0.03, 0.4), (0.1, 0.56), (0.2, 0.66)], [(0.17, 0.0), (0.17, 0.2), (0.17, 0.4), (0.2, 0.56), (0.22, 0.66)], 0.022, nu=8, nc=2, colfn=wingc, tip=0.4)
    parts += [w, mirrored(w)]
    # the mirrored wing's faces swap sides: top stays top by the normal in the look; the tail
    t_ = fin((0.0, Y(0.68), 0.0), [0, 1, 0], [1, 0, 0], [(0.0, 0.0), (0.08, 0.05), (0.18, 0.07)], [(0.19, 0.0), (0.19, 0.04), (0.18, 0.07)], 0.012, nu=3, nc=2, colfn=solid('#f0f0ea'), tip=0.5)
    parts += [t_, mirrored(t_)]
    for side in (-1, 1):
        parts.append(b.eye(0.135, 66 * RAD, side, 0.008, hexc('#0a0c0e'), iris=hexc('#d8d09a'), lid=hexc('#d8a038'), segs=6, pupil=0.5))
        s = np.linspace(0.0, 1.0, 4)
        parts.append(b.strip(0.01 + 0.08 * s, 94 * RAD * np.ones(4), side, 0.0022, hexc('#3a2a10'), lift=0.0006))
    parts.append(disc_at(b.point(np.array(0.04), np.array(165 * RAD), 1.0), b.normal(np.array(0.04), np.array(165 * RAD), 1.0), 0.0065, hexc('#d0301e'), segs=5, lift=0.001))
    return join(parts)


def goat():
    """Capra hircus, a billy on the Sunward meadows, shoulder 0.72 m: a deep barrel on four lean legs, the back straight, the neck rising to a long narrow face, swept-back ridged horns, a beard, a short tail held up, cloven dark hooves. Brown and cream. Feet on z = 0, head to -y."""
    L = 1.36
    H = 0.74                                                             # the spine's height at the shoulder

    def ax(t):
        return (H / L) + 0.2 * sstep(0.34, 0.08, t) ** 1.2 - 0.03 * t

    k = dict(
        t=[0.0, 0.015, 0.04, 0.08, 0.12, 0.17, 0.22, 0.28, 0.36, 0.48, 0.62, 0.76, 0.86, 0.92, 0.96],
        top=[0.012, 0.022, 0.032, 0.044, 0.056, 0.058, 0.06, 0.08, 0.116, 0.132, 0.136, 0.13, 0.1, 0.05, 0.012],
        bot=[-0.012, -0.022, -0.03, -0.04, -0.054, -0.062, -0.074, -0.1, -0.15, -0.18, -0.19, -0.16, -0.11, -0.06, -0.014],
        hw=[0.01, 0.018, 0.026, 0.034, 0.044, 0.05, 0.05, 0.062, 0.088, 0.11, 0.122, 0.112, 0.086, 0.05, 0.014],
        n=[2.0] * 15,
    )
    b = Body(L, k, ax=ax)
    pn = Perlin3(301)

    def skin(t, phi, side, P, fphi, ft):
        n = pn.fbm(P[..., 0] * 2.2, P[..., 1] * 2.2, P[..., 2] * 2.2, 2)
        col = mix(hexc('#6a4a2c'), hexc('#d8c8a8'), sstep(-0.22, 0.26, n + (phi - 1.5) * 0.14)[..., None])
        return mix(col, hexc('#3a2a1c'), sstep(0.09, 0.02, t)[..., None] * 0.5)

    ts = np.concatenate([[0.004, 0.015, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.18, 0.21, 0.25], np.linspace(0.29, 0.955, 14)])
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 9), skin)]
    Y = lambda t: b.y0 + t * L
    leg, hoof, horn = hexc('#7a5a3a'), hexc('#1a1612'), hexc('#6a5a46')
    for side in (-1, 1):
        for (t0, back) in ((0.36, 0.0), (0.82, 1.0)):
            top = b.point(np.array(t0), np.array(140 * RAD), side)
            base = np.array([side * 0.085, top[1], 0.05])
            hock = np.array([side * 0.08, top[1] + 0.05 * back - 0.012, 0.30 + 0.05 * back])
            mid = np.array([side * 0.09, top[1] - 0.03 * back, 0.14])
            parts.append(leg_mesh([top + np.array([0, 0, 0.02]), hock, mid, base], [0.06, 0.03, 0.022, 0.024], leg, hexc('#5a4228'), sides=5))
            h = lathe([(0.03, 0.0), (0.034, 0.03), (0.024, 0.06)], 5, S=False).moved(base[0], base[1], 0.0)
            h.tint(hoof)
            parts.append(h)
        # the horns: from the crown, up and back in a long curve, ridged
        c = b.point(np.array(0.135), np.array(16 * RAD), side)
        pts = [c, c + np.array([side * 0.02, 0.05, 0.1]), c + np.array([side * 0.05, 0.16, 0.16]), c + np.array([side * 0.09, 0.28, 0.13]), c + np.array([side * 0.11, 0.35, 0.05])]
        parts.append(leg_mesh(pts, [0.024, 0.02, 0.016, 0.01, 0.003], horn, hexc('#3a3026'), band=60.0, sides=4))
        # the ear: a soft leaf, out to the side
        e = b.point(np.array(0.15), np.array(52 * RAD), side)
        parts.append(fin(e, unit([0.0, 1.0, 0.1]), unit([side * 1.0, 0.1, 0.1]), [(0.0, 0.0), (-0.01, 0.06), (0.02, 0.14)], [(0.05, 0.0), (0.05, 0.08), (0.02, 0.14)], 0.008, nu=3, nc=2, colfn=solid('#6a4a2c'), tip=0.5))
        parts.append(b.eye(0.1, 54 * RAD, side, 0.012, hexc('#08090a'), iris=hexc('#b8983a'), lid=hexc('#4a3420'), segs=8, pupil=0.5))
        parts.append(disc_at(b.point(np.array(0.008), np.array(60 * RAD), side), b.normal(np.array(0.008), np.array(60 * RAD), side), 0.006, hexc('#100c0a'), segs=5, lift=0.001))
    # the beard, the tail
    q = b.point(np.array(0.05), np.array(math.pi))
    parts.append(tube([q + np.array([0, 0, 0.01]), q + np.array([0.0, 0.015, -0.07]), q + np.array([0.0, 0.03, -0.13])], [0.018, 0.012, 0.002], sides=4).tinted(hexc('#3a2a1c')))
    q = b.point(np.array(0.93), np.array(20 * RAD))
    parts.append(tube([q, q + np.array([0.0, 0.05, 0.05]), q + np.array([0.0, 0.07, 0.1])], [0.022, 0.018, 0.004], sides=4).tinted(hexc('#5a4228')))
    return join(parts)


def parrotfish():
    """Scarus, a blue-green parrotfish, 0.7 m: a heavy deep body with big plate scales, a blunt forehead, teeth fused into a beak for biting coral, a long low dorsal, a lyre tail. Turquoise and green, pink at the seams."""
    L = 0.7
    k = dict(t=[0.0, 0.03, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.78, 0.84], top=[0.012, 0.04, 0.09, 0.145, 0.185, 0.2, 0.18, 0.115, 0.075, 0.05], bot=[-0.018, -0.045, -0.085, -0.125, -0.155, -0.17, -0.15, -0.095, -0.065, -0.05], hw=[0.012, 0.03, 0.05, 0.07, 0.085, 0.09, 0.075, 0.045, 0.028, 0.018], n=[2.1] * 10)
    pn = Perlin3(311)

    def skin(t, phi, side, P, fphi, ft):
        q = np.sin(P[..., 1] * 62.0 + np.sin(P[..., 2] * 40.0) * 1.2) * np.sin(P[..., 2] * 62.0)
        col = mix(hexc('#1fa89a'), hexc('#3cc88a'), sstep(-0.3, 0.5, q)[..., None])
        col = mix(col, hexc('#e88aa8'), (sstep(0.55, 0.9, np.abs(q)) * 0.6)[..., None])
        return mix(col, hexc('#2a6ad0'), (sstep(0.12, 0.05, t) * 0.7)[..., None])

    ts = [0.006, 0.03, 0.06, 0.1, 0.15, 0.22, 0.32, 0.44, 0.56, 0.68, 0.78, 0.84]
    b = Body(L, k)
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 8), skin)]
    Y = lambda t: b.y0 + t * L
    on_top = lambda t: float(b.point(np.array(t), np.array(0.0))[2])
    on_bot = lambda t: float(b.point(np.array(t), np.array(math.pi))[2])
    fc = lambda u, c, s: mix(np.broadcast_to(hexc('#1a8a90'), u.shape + (3,)).copy(), hexc('#e88aa8'), sstep(0.5, 1.0, u)[..., None])
    ta = [0.24, 0.4, 0.56, 0.7, 0.8]
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(t), on_top(t) + 0.05 * L) for t in ta], [(Y(t), on_top(t) - 0.005) for t in ta], 0.008, nu=6, nc=2, colfn=lambda u, c, s: fc(1.0 - c, c, s), tip=0.6))
    tb = [0.54, 0.66, 0.76, 0.82]
    parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(t), on_bot(t) - 0.045 * L) for t in tb], [(Y(t), on_bot(t) + 0.005) for t in tb], 0.008, nu=4, nc=2, colfn=lambda u, c, s: fc(1.0 - c, c, s), tip=0.6))
    for sgn in (1.0, -1.0):
        parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(0.82), sgn * 0.02), (Y(0.92), sgn * 0.09), (Y(1.0), sgn * 0.16)], [(Y(0.9), 0.0), (Y(0.93), sgn * 0.03), (Y(1.0), sgn * 0.16)], 0.008, nu=4, nc=2, colfn=fc, tip=0.5))
    p = b.point(np.array(0.3), np.array(100 * RAD), 1.0)
    pf = fin(p, unit([0.2, 1.0, -0.1]), unit([0.6, 0.4, -0.7]), [(0.0, 0.0), (0.03, 0.06), (0.06, 0.12)], [(0.07, 0.0), (0.1, 0.06), (0.06, 0.12)], 0.006, nu=3, nc=2, colfn=fc, tip=0.5)
    parts += [pf, mirrored(pf)]
    for side in (-1, 1):
        parts.append(b.eye(0.145, 62 * RAD, side, 0.02, hexc('#050608'), iris=hexc('#e8c060'), segs=8, pupil=0.55))
        s = np.linspace(0.0, 1.0, 6)
        parts.append(b.strip(0.006 + 0.05 * s, (92 + 10 * s) * RAD, side, 0.012 - 0.006 * s, hexc('#d8e4dc'), lift=0.001))     # the beak
    return join(parts)


def barracuda():
    """Sphyraena barracuda, 1.3 m: a silver spear: a long pike head with the lower jaw jutting past the upper, fangs, two small dorsals set far apart, a forked tail. Dark bars along a steel back."""
    L = 1.3
    k = dict(t=[0.0, 0.02, 0.06, 0.12, 0.2, 0.35, 0.55, 0.72, 0.82, 0.87], top=[0.002, 0.008, 0.018, 0.03, 0.044, 0.056, 0.054, 0.04, 0.026, 0.016], bot=[-0.004, -0.012, -0.022, -0.033, -0.046, -0.058, -0.054, -0.04, -0.024, -0.014], hw=[0.002, 0.008, 0.016, 0.026, 0.036, 0.044, 0.04, 0.028, 0.016, 0.01], n=[2.0] * 10)

    def skin(t, phi, side, P, fphi, ft):
        bars = sstep(0.3, 0.8, np.sin(P[..., 1] * 15.0)) * sstep(1.2, 0.6, phi)
        col = mix(hexc('#52626a'), hexc('#d8dee2'), sstep(0.3, 1.3, phi)[..., None])
        return mix(mix(col, hexc('#20282c'), (bars * 0.75)[..., None]), hexc('#f2f4f4'), sstep(1.9, 2.5, phi)[..., None])

    ts = [0.004, 0.02, 0.05, 0.09, 0.14, 0.2, 0.3, 0.42, 0.55, 0.68, 0.78, 0.87]
    b = Body(L, k)
    parts = [b.loft(ts, lambda t: np.linspace(0, math.pi, 8), skin)]
    Y = lambda t: b.y0 + t * L
    on_top = lambda t: float(b.point(np.array(t), np.array(0.0))[2])
    on_bot = lambda t: float(b.point(np.array(t), np.array(math.pi))[2])
    fc = solid('#3a4650')
    parts.append(fin((0.0, Y(0.38), on_top(0.38) - 0.005), [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.04, 0.06), (0.09, 0.09)], [(0.12, 0.0), (0.1, 0.05), (0.09, 0.09)], 0.008, nu=3, nc=2, colfn=fc, tip=0.5))
    parts.append(fin((0.0, Y(0.68), on_top(0.68) - 0.005), [0, 1, 0], [0, 0, 1], [(0.0, 0.0), (0.03, 0.05), (0.07, 0.08)], [(0.1, 0.0), (0.09, 0.04), (0.07, 0.08)], 0.008, nu=3, nc=2, colfn=fc, tip=0.5))
    parts.append(fin((0.0, Y(0.68), on_bot(0.68) + 0.005), [0, 1, 0], [0, 0, -1], [(0.0, 0.0), (0.03, 0.05), (0.07, 0.07)], [(0.1, 0.0), (0.09, 0.04), (0.07, 0.07)], 0.008, nu=3, nc=2, colfn=fc, tip=0.5))
    for sgn in (1.0, -1.0):
        parts.append(fin((0, 0, 0), [0, 1, 0], [0, 0, 1], [(Y(0.84), sgn * 0.012), (Y(0.92), sgn * 0.08), (Y(1.0), sgn * 0.15)], [(Y(0.92), 0.0), (Y(0.94), sgn * 0.03), (Y(1.0), sgn * 0.15)], 0.01, nu=4, nc=2, colfn=fc, tip=0.5))
    p = b.point(np.array(0.27), np.array(112 * RAD), 1.0)
    pf = fin(p, unit([0.1, 1.0, -0.1]), unit([0.6, 0.4, -0.7]), [(0.0, 0.0), (0.03, 0.06), (0.06, 0.1)], [(0.06, 0.0), (0.08, 0.05), (0.06, 0.1)], 0.006, nu=3, nc=2, colfn=fc, tip=0.5)
    parts += [pf, mirrored(pf)]
    white = hexc('#f0ece0')
    for side in (-1, 1):
        s = np.linspace(0.0, 1.0, 6)
        parts.append(b.strip(0.004 + 0.1 * s, (104 - 6 * s) * RAD, side, 0.008, hexc('#1a1c1e'), lift=0.0012))
        for q in (0.2, 0.42, 0.64, 0.86):
            parts.append(tooth(b.point(np.array(0.004 + 0.1 * q), np.array((104 - 6 * q) * RAD), side), [0.0, 0.0, -1.0], 0.016, 0.004, white))
        parts.append(b.eye(0.115, 68 * RAD, side, 0.016, hexc('#050608'), iris=hexc('#c8c8a0'), segs=8, pupil=0.6))
    return join(parts)


def nautilus():
    """Nautilus pompilius, the emblem of Meridon, a shell 0.26 m across: one log spiral closing on itself in the vertical plane, tiger-barred in rust over cream fading to pearl at the mouth; a hood, a pale eye on a stalk, a mass of slender tentacles reaching forward."""
    n = 44
    th = np.linspace(0.0, 2.4 * TAU, n)
    a, g = 0.0235, 0.22
    r = a * np.exp(g * th)
    cen = np.stack([np.zeros(n), -r * np.cos(th), r * np.sin(th)], 1)
    rad = 0.62 * r * (1.0 - np.exp(-g * TAU) * 0.3)
    m = tube(cen, rad, sides=10, cap_end=False)
    C = m.corners()
    ang = np.arctan2(C[..., 2], -C[..., 1]) + 0.0
    q = np.linalg.norm(C[..., 1:], axis=-1)
    u = np.log(np.maximum(q, 1e-4) / a) / g / (2.4 * TAU)
    bars = sstep(-0.1, 0.5, np.sin(ang * 13.0 + q * 44.0))
    col = mix(hexc('#f0e6d0'), hexc('#a4482a'), (bars * sstep(0.95, 0.6, u) * 0.9)[..., None])
    m.C[..., :3] = col
    mouth, md = cen[-1], unit(cen[-1] - cen[-2])
    parts = [m]
    hood = sphere(mouth + md * 0.02, (0.05, 0.06, 0.055), seg=7, rings=4)
    hood.tint(hexc('#9a5a42'))
    parts.append(hood)
    fwd = unit(md + np.array([0.0, -0.4, 0.0]))
    rs = np.random.RandomState(321)
    for i in range(14):
        t_ = i / 14.0 * TAU
        o = mouth + md * 0.05 + np.array([0.04 * math.cos(t_), 0.0, 0.04 * math.sin(t_)])
        d = unit(fwd + np.array([math.cos(t_) * 0.4, 0.0, math.sin(t_) * 0.4]))
        L = rs.uniform(0.09, 0.15)
        parts.append(tube([o, o + d * L * 0.5, o + d * L + np.array([0.0, 0.0, -0.01])], [0.005, 0.004, 0.0015], sides=3).tinted(hexc('#e8b49a')))
    for side in (-1, 1):
        parts.append(eye_at(mouth + md * 0.03 + np.array([side * 0.044, 0.0, 0.02]), np.array([side * 1.0, 0.0, 0.0]), 0.011, hexc('#18120e'), iris=hexc('#d8c8a8'), segs=8, pupil=0.5))
    return join(parts).moved(0.0, 0.0, -0.02)


def ember_eel():
    """The ember eel of the Vent Fields, 2.4 m, our own animal: a moray's body, soot-black, cracked along its length by seams of living orange, as if the fish had been drawn out of the vent itself. The seams burn past 0.95, so the look lets them glow."""
    m = moray().scaled(1.09)
    C = m.corners()
    pn = Perlin3(331)
    n = pn.fbm(C[..., 0] * 9.0, C[..., 1] * 4.0, C[..., 2] * 9.0, 2)
    mean = m.C[..., :3].mean(axis=-1, keepdims=True)
    dark = mix(hexc('#100e0e'), hexc('#2a2422'), np.clip(mean * 1.4, 0, 1))
    seam = sstep(0.05, 0.015, np.abs(n))[..., None]
    m.C[..., :3] = mix(dark, np.array([1.0, 0.5, 0.1]), seam)
    return m


# name: (maker, collision, shapes, pitch, ao): creatures carry no collision: the game hits them by a sphere
CREATURES2 = {
    'parrotfish': (parrotfish, None, 0, 0.02, 0.0),
    'barracuda': (barracuda, None, 0, 0.02, 0.0),
    'nautilus': (nautilus, None, 0, 0.01, 0.0),
    'ember_eel': (ember_eel, None, 0, 0.02, 0.0),
    'hammerhead': (hammerhead, None, 0, 0.05, 0.0),
    'moray': (moray, None, 0, 0.02, 0.0),
    'anglerfish': (anglerfish, None, 0, 0.02, 0.0),
    'giant_crab': (giant_crab, None, 0, 0.03, 0.0),
    'narwhal': (narwhal, None, 0, 0.05, 0.0),
    'seal': (seal, None, 0, 0.04, 0.0),
    'sea_otter': (sea_otter, None, 0, 0.02, 0.0),
    'gull': (gull, None, 0, 0.02, 0.0),
    'crab': (crab, None, 0, 0.01, 0.0),
    'goat': (goat, None, 0, 0.02, 0.0),
}
