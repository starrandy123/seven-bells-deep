# The Warden's bronze: pauldron on the lead shoulder, bracers, belt, greaves, a baldric, the torn mantle, a slim circlet, the trident.
import math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import gear
from gear import Gear, Limb, shell, tube, blade, ribbon, grid, BRONZE, BRONZE_DK, PEARL, TEAL, CYAN, LEATHER, M_METAL, M_GLOW, M_BOSS

def body_bvh(co, d):
    ls = d['loop_start']; cv = d['corner_v']; idx = np.stack((ls, ls + 1, ls + 2), 1)
    return BVHTree.FromPolygons([tuple(p) for p in co.tolist()], cv[idx].tolist())

def nearest_weights(co, W, BONES, sel=None):
    """A piece that bends with him copies the skin's weights from the nearest skin."""
    idx = np.nonzero(sel)[0] if sel is not None else np.arange(len(co))
    C = co[idx]; Wi = W[idx]
    def w(p):
        d2 = ((C - np.array(p)) ** 2).sum(1); k = np.argsort(d2)[:3]; f = 1 / (d2[k] + 1e-5); f /= f.sum()
        v = (Wi[k] * f[:, None]).sum(0); o = {}
        for b in np.argsort(-v)[:4]:
            if v[b] > 0.01: o[BONES[b]] = float(v[b])
        return o
    return w

def dress(g, co, W, BI, BONES, J, gR, tR, gL, cape_top, cape_z, hair0, d, log):
    wv = lambda *n: sum(W[:, BI[x]] for x in n)
    bvh = body_bvh(co, d)
    n0 = lambda: g.tris()
    # the trident. The fan of its tines lies in the plane of the hand's swing
    fan = np.cross(tR, (0.0, 0.0, 1.0)); gear.trident(g, gR, tR, fan); log('trident', n0())
    # ---- bracers
    for s in 'RL':
        L = Limb(co, wv('fore_' + s) > 0.5, J['fore_' + s], J['hand_' + s])
        shell(g, L, 0.30, 0.98, 'fore_' + s, rows=7, cols=16, off=0.006, flare=lambda t: 0.012 * t * t + 0.006 * (1 - t))
        # a fin along the outside of the arm, swept to the elbow
        out = L.e1 * math.cos(1.57 if s == 'L' else -1.57) + L.e2 * math.sin(1.57 if s == 'L' else -1.57)
        for k, (a, b, h) in enumerate(((0.40, 0.14, 0.050), (0.62, 0.34, 0.042), (0.82, 0.58, 0.034))):
            A = np.array(L.A + L.u * a * L.L + out * (L.r(a * L.L, math.atan2(out @ L.e2, out @ L.e1)) + 0.012)); B = np.array(L.A + L.u * b * L.L + out * (L.r(a * L.L, math.atan2(out @ L.e2, out @ L.e1)) + h + 0.02))
            blade(g, A, B, L.u, 0.019, {'fore_' + s: 1.0}, thick=0.004, n=6, soft=True)
        # the glow line on the bracer's back
        ang = math.atan2(out @ L.e2, out @ L.e1) + 0.75
        pts = [L.p(t * L.L, ang, 0.0125 + 0.012 * ((t - 0.30) / 0.68) ** 2) for t in np.linspace(0.34, 0.94, 6)]
        nr = [tuple(L.e1 * math.cos(ang) + L.e2 * math.sin(ang))] * 6
        ribbon(g, pts, nr, 0.0024, {'fore_' + s: 1.0})
    log('bracers', n0())
    # ---- greaves and knee cops
    for s in 'RL':
        L = Limb(co, wv('shin_' + s) > 0.5, J['shin_' + s], J['foot_' + s])
        shell(g, L, 0.16, 0.90, 'shin_' + s, rows=9, cols=16, off=0.006, a0=-2.15, a1=2.15, closed=False, flare=lambda t: 0.012 * max(t - 0.7, 0) * 3)
        shell(g, L, -0.06, 0.135, 'shin_' + s, rows=5, cols=10, off=0.011, a0=-1.2, a1=1.2, closed=False, flare=lambda t: 0.012 * math.sin(t * math.pi))
        ang = 0.0
        pts = [L.p(t * L.L, ang, 0.0135) for t in np.linspace(0.20, 0.86, 7)]
        ribbon(g, pts, [tuple(L.e1)] * 7, 0.0028, {'shin_' + s: 1.0})
    log('greaves', n0())
    # ---- the belt: bronze plates on a dark band, sat just on top of the wrap
    z0, z1 = 0.99, 1.075
    sel = (wv('hips', 'spine_1', 'spine_2') > 0.3) & (np.abs(co[:, 0]) < 0.30)
    L = Limb(co, sel, (0, 0.01, 0.82), (0, 0.01, 1.22), ns=40, na=36)
    fr = lambda z: (z - 0.82) / 0.40
    shell(g, L, fr(z0), fr(z1), 'hips', rows=4, cols=32, off=0.006, col=BRONZE, trim=True)
    # the buckle: a round boss, wave-marked with light
    bc = np.array(L.p(fr(1.033) * L.L, 0.0, 0.020))
    ring = lambda r, y: [tuple(bc + np.array((math.cos(a) * r, y, math.sin(a) * r))) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
    grid(g, [ring(0.062, 0.012), ring(0.060, -0.002), ring(0.050, -0.012), ring(0.036, -0.017), ring(0.034, -0.012), ring(0.014, -0.012)], {'hips': 1.0}, BRONZE, M_BOSS, closed=True, hard=True, cap1=True)
    pts = [tuple(bc + np.array((x, -0.0135, 0.018 * math.sin(x * 90)))) for x in np.linspace(-0.03, 0.03, 8)]
    ribbon(g, pts, [(0, -1, 0)] * 8, 0.0028, {'hips': 1.0})
    # the war-kilt: measured against the hull of hips and thighs together
    sel2 = (co[:, 2] > 0.55) & (co[:, 2] < 1.2) & (wv('arm_R', 'fore_R', 'hand_R', 'arm_L', 'fore_L', 'hand_L') < 0.1)
    L2 = Limb(co, sel2, (0, 0.01, 0.60), (0, 0.01, 1.20), ns=36, na=40); L2.smin_z = 0.60
    gear.kilt(g, L2, z0 + 0.012, 15, g.rng)
    log('belt', n0())
    # ---- the pauldron, left shoulder, three lames and a raised crest, all on the upper arm
    s = 'L'
    L = Limb(co, wv('arm_' + s) > 0.45, J['arm_' + s], J['fore_' + s], ns=40, na=30)
    o = np.array((0.0, 0.0, 1.0)) - L.u * L.u[2]; o /= np.linalg.norm(o); th = math.atan2(o @ L.e2, o @ L.e1)
    # three flat plates, shingled: each flares straight out to a crisp lip that lies over the one below
    for (a, b, off, wd, rows) in ((0.40, 0.72, 0.012, 2.0, 3), (0.12, 0.47, 0.022, 2.25, 3), (-0.22, 0.20, 0.032, 2.4, 4)):
        shell(g, L, a, b, 'arm_' + s, rows=rows, cols=14, off=off, a0=th - wd, a1=th + wd, closed=False, flare=lambda t: 0.024 * t)
    # a keel along the top lame and fins flaring back: the shoulder's silhouette
    for k, (t0, t1, h) in enumerate(((-0.18, 0.04, 0.085), (0.02, 0.24, 0.070), (0.20, 0.42, 0.055))):
        A = L.p(t0 * L.L, th + 0.55, 0.05); B = np.array(L.p(t1 * L.L, th + 0.55, 0.05)) + o * h + np.array((0, 0.03, 0))
        blade(g, A, B, L.u, 0.024, {'arm_' + s: 1.0}, thick=0.006, n=7, soft=True)
    pts = [L.p(t * L.L, th, 0.066 + 0.018 * math.sin((t + 0.2) / 0.55 * math.pi) - 0.02 * max(t - 0.1, 0) / 0.4) for t in np.linspace(-0.16, 0.30, 6)]
    ribbon(g, pts, [tuple(o)] * 6, 0.003, {'arm_' + s: 1.0})
    log('pauldron', n0())
    # ---- the baldric: left shoulder across the chest to the right hip, and round the back
    def on_body(x, z, front):
        dirn = Vector((0, 1 if front else -1, 0)); org = Vector((x, -1.0 if front else 1.0, z))
        hit = bvh.ray_cast(org, dirn, 3.0)
        return (np.array(tuple(hit[0])), np.array(tuple(hit[1]))) if hit[0] is not None else (None, None)
    w_b = nearest_weights(co, W, BONES, (wv('hips', 'spine_1', 'spine_2', 'spine_3', 'neck') > 0.3))
    path_f = [(0.235 - 0.40 * t, 1.515 - 0.40 * t ** 0.95) for t in np.linspace(0.0, 1.0, 10)]
    path_b = [(0.235 - 0.40 * t, 1.525 - 0.42 * t ** 0.95) for t in np.linspace(0.0, 1.0, 10)]
    for path, front in ((path_f, True), (path_b, False)):
        rows = []
        prev = None
        for (x, z) in path:
            p, n = on_body(x, z, front)
            if p is None: continue
            if n.dot(np.array((0, -1 if front else 1, 0))) < 0: n = -n
            t = np.array((-0.40, 0.0, -0.40)); t /= np.linalg.norm(t); sd = np.cross(n, t); sd /= np.linalg.norm(sd)
            wd = 0.027
            rows.append([tuple(p + sd * wd + n * 0.002), tuple(p + sd * wd * 0.8 + n * 0.008), tuple(p - sd * wd * 0.8 + n * 0.008), tuple(p - sd * wd + n * 0.002)])
        grid(g, rows, w_b, lambda i, j: (LEATHER if j == 1 else BRONZE_DK), (0, 0, 0, 0), 'cloth', closed=False, hard=True)
    # a boss where the strap crosses the breastbone, a bronze disc over the heart
    pc, nc = on_body(0.055, 1.385, True)
    b1 = np.cross(nc, (0, 0, 1)); b1 /= np.linalg.norm(b1); b2 = np.cross(b1, nc)
    ring2 = lambda r, h: [tuple(pc + nc * h + (b1 * math.cos(a) + b2 * math.sin(a)) * r) for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)]
    w_sp = {'spine_3': 1.0}
    grid(g, [ring2(0.046, 0.004), ring2(0.042, 0.016), ring2(0.030, 0.021), ring2(0.012, 0.022)], w_sp, BRONZE, M_BOSS, closed=True, hard=True, cap1=True)
    log('baldric', n0())
    # ---- the mantle: torn, fin-rayed, from the left shoulder across the back
    def surface(x, z):
        hit = bvh.ray_cast(Vector((x, 1.0, z)), Vector((0, -1, 0)), 1.2)
        return hit[0].y if hit[0] is not None else None
    gear.mantle(g, surface, float(cape_top[1]), 0.72, 18, 36, ['cape_%d' % i for i in range(1, 6)], g.rng, 'spine_3')
    # the clasps that hold its corners, either side of the neck
    for sx in (-1, 1):
        p, n = on_body(sx * 0.215, 1.505, False)
        if p is None: continue
        p = p + np.array((0, 0, 0.006)); b1 = np.array((1.0, 0, 0)); b2 = np.cross(n, b1); b2 /= np.linalg.norm(b2)
        ring4 = lambda r, h: [tuple(p + n * h + (b1 * math.cos(a) + b2 * math.sin(a)) * r) for a in np.linspace(0, 2 * math.pi, 10, endpoint=False)]
        grid(g, [ring4(0.030, 0.0), ring4(0.028, 0.012), ring4(0.016, 0.018)], {'spine_3': 1.0}, BRONZE, M_BOSS, closed=True, hard=True, cap1=True)
    log('mantle', n0())
    # ---- a slim circlet and the two tails of its tie
    L = Limb(co, (wv('head') > 0.5) & (co[:, 2] > 1.64), (0, J['head'][1] - 0.02, 1.60), (0, J['head'][1] - 0.02, 1.86), ns=26, na=32)
    fz = lambda z: (z - 1.60) / 0.26
    ring3 = lambda z, off: [L.p(fz(z - 0.005 * math.cos(a) * 3) * L.L, a, off) for a in np.linspace(-math.pi, math.pi, 28, endpoint=False)]
    grid(g, [ring3(1.776, 0.001), ring3(1.776, 0.0055), ring3(1.783, 0.0065), ring3(1.790, 0.0055), ring3(1.790, 0.001)], {'head': 1.0}, BRONZE, M_METAL, closed=True, hard=True)
    # the brow gem
    fr_pt = np.array(L.p(fz(1.786) * L.L, 0.0, 0.012)); blade(g, fr_pt + np.array((0, -0.002, -0.008)), fr_pt + np.array((0, -0.005, 0.019)), (1, 0, 0), 0.0065, {'head': 1.0}, col=CYAN, mask=M_GLOW, thick=0.003, n=3, belly=0.4)
    gear.ponytail(g, hair0, None, g.rng)
    log('circlet', n0())
