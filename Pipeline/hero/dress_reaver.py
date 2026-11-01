# The Reaver's iron: rusted plates that have outlasted the man, barnacles, a ridge of spines grown down his back, gill fins, and the spear.
import math
import numpy as np
from mathutils import Vector
import gear
from gear import Limb, shell, blade, grid, RUST, IRON
from dress_hero import body_bvh, nearest_weights

M_RUST = (0.0, 0.0, 0.5, 0.0)
PLATE = (0.15, 0.078, 0.032)
TRIM = (0.11, 0.035, 0.014)

def dress(g, co, W, BI, BONES, J, gR, tR, d, eyes, log):
    wv = lambda *n: sum(W[:, BI[x]] for x in n)
    rng = g.rng
    bvh = body_bvh(co, d)
    fan = np.cross(tR, (0.0, 0.0, 1.0)); gear.spear(g, gR, tR, fan); log('spear', g.tris())
    def plate(L, a, b, bone, **k): shell(g, L, a, b, bone, col=PLATE, mask=M_RUST, trim_col=TRIM, **k)
    # the shoulders: heavy on the left, a ruin on the right
    L = Limb(co, wv('arm_L') > 0.45, J['arm_L'], J['fore_L'], ns=40, na=30)
    o = np.array((0.0, 0.0, 1.0)) - L.u * L.u[2]; o /= np.linalg.norm(o); th = math.atan2(o @ L.e2, o @ L.e1)
    for (a, b, off, wd, rows) in ((0.26, 0.60, 0.018, 2.0, 4), (-0.20, 0.32, 0.032, 2.4, 5)):
        plate(L, a, b, 'arm_L', rows=rows, cols=10, off=off, a0=th - wd, a1=th + wd, closed=False, flare=lambda t: 0.018 * math.sin(t * math.pi))
    L = Limb(co, wv('arm_R') > 0.45, J['arm_R'], J['fore_R'], ns=40, na=30)
    o = np.array((0.0, 0.0, 1.0)) - L.u * L.u[2]; o /= np.linalg.norm(o); th = math.atan2(o @ L.e2, o @ L.e1)
    plate(L, -0.14, 0.30, 'arm_R', rows=4, cols=8, off=0.028, a0=th - 1.5, a1=th + 1.9, closed=False, flare=lambda t: 0.014 * math.sin(t * math.pi))
    # one bracer, one greave, a chest plate hanging on by its straps
    L = Limb(co, wv('fore_L') > 0.5, J['fore_L'], J['hand_L']); plate(L, 0.32, 0.94, 'fore_L', rows=4, cols=10, off=0.012)
    L = Limb(co, wv('shin_R') > 0.5, J['shin_R'], J['foot_R']); plate(L, 0.12, 0.74, 'shin_R', rows=5, cols=10, off=0.012, a0=-2.0, a1=2.0, closed=False)
    sel = (wv('spine_2', 'spine_3') > 0.4) & (np.abs(co[:, 0]) < 0.26)
    L = Limb(co, sel, (0, 0.01, 1.10), (0, 0.01, 1.54), ns=30, na=36)
    plate(L, 0.32, 0.86, 'spine_3', rows=6, cols=12, off=0.014, a0=-1.25, a1=0.85, closed=False, flare=lambda t: 0.012 * math.sin(t * math.pi))
    log('plates', g.tris())
    # a ridge of spines down the back, the hunch's outline
    for k in range(9):
        t = k / 8; z = 1.50 - 0.42 * t
        hit = bvh.ray_cast(Vector((0.0, 1.0, z)), Vector((0, -1, 0)), 1.2)
        if hit[0] is None: continue
        p = np.array(tuple(hit[0])); h = (0.13 - 0.07 * t) * (0.8 + 0.4 * rng.random())
        bone = 'spine_3' if z > 1.33 else 'spine_2' if z > 1.2 else 'spine_1'
        blade(g, p + np.array((0, -0.01, 0)), p + np.array((0, h, h * 0.75)), (0, 0, 1), 0.030, {bone: 1.0}, col=IRON, mask=(0, 0, 0.2, 1.0), thick=0.005, n=3, belly=0.3)
    # gill fins behind the jaw
    for sx in (-1, 1):
        base = np.array((sx * 0.082, J['head'][1] + 0.02, J['head'][2] + 0.04))
        for k in range(3):
            blade(g, base + np.array((0, 0.0, -0.02 * k)), base + np.array((sx * 0.085, 0.10, 0.01 - 0.05 * k)), (0, 0, 1), 0.020, {'head': 1.0}, col=IRON, mask=(0, 0, 0.2, 1.0), thick=0.003, n=3, belly=0.35)
    log('fins', g.tris())
    # the eyes: real light, set in the sockets, so they read from across the water
    AMBER = (1.0, 0.45, 0.04)
    import tex
    for e in eyes:
        e = np.array(e) + np.array((0, -0.016, 0))
        rows = [[tuple(e + np.array((math.cos(a) * r, zy[0], math.sin(a) * r * 0.62))) for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)] for r, zy in ((0.0035, (0.010,)), (0.0135, (0.0,)), (0.0035, (-0.010,)))]
        grid(g, rows, {'head': 1.0}, AMBER, (0, 1.0, 0, 0), 'glow', closed=True, hard=False, cap0=True, cap1=True, uvscale=1.0)
    # barnacles: clusters where the current hits. Never on the face
    ok = (wv('hand_R', 'hand_L', 'foot_R', 'foot_L', 'toe_R', 'toe_L') < 0.2) & (co[:, 2] > 0.32) & ~((co[:, 2] > 1.5) & (co[:, 1] < 0.03))
    sel = np.nonzero(ok)[0]
    score = 0.30 + 0.70 * (co[sel, 2] / 1.8) + 0.5 * (co[sel, 1] > 0.02)            # more up high and on the back
    pts = []
    tries = 0
    while len(pts) < 78 and tries < 6000:
        tries += 1
        k = rng.randrange(len(sel))
        if rng.random() > score[k] * 0.75: continue
        near = sel[np.argsort(((co[sel] - co[sel[k]]) ** 2).sum(1))[:9]]
        for i in rng.sample(list(near), 6): pts.append(int(i))
    me_n = np.zeros_like(co)
    ls = d['loop_start']; cv = d['corner_v']; tri = cv[np.stack((ls, ls + 1, ls + 2), 1)]
    fn = np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]])
    for k in range(3): np.add.at(me_n, tri[:, k], fn)
    me_n /= np.maximum(np.linalg.norm(me_n, axis=1, keepdims=True), 1e-9)
    for i in pts:
        b = BONES[int(np.argmax(W[i]))]
        r = 0.011 + 0.020 * rng.random() ** 2
        gear.barnacle(g, co[i], me_n[i], r, r * 0.9, {b: 1.0})
    log('barnacles', g.tris())
