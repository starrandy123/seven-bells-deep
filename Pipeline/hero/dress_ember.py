# The Emberkin's stone: slag grown over him in plates, thick on the shoulders and the shins, split down the chest so the heart shows; spikes where the plates broke; a crown of black horns. No cloth, no iron.
# The fire isn't painted on: web/js/ember.js burns it into what's built here, by the mask each piece carries. r how hot it runs (0 a cold plate, 1 the heart), g light of its own (eyes, vents), b metal, a unused.
import math
import numpy as np
from mathutils import Vector
import gear
from gear import Limb, shell, blade, grid
from dress_hero import body_bvh

PLATE = (0.72, 0.68, 0.64)
EDGE = (0.42, 0.38, 0.36)
COLD = (0.10, 0.0, 0.0, 0.0)
WARM = (0.34, 0.0, 0.0, 0.0)
SPIKE = (0.46, 0.0, 0.0, 0.0)
GLOW = (1.0, 1.0, 0.0, 0.0)

def dress(g, co, W, BI, BONES, J, d, eyes, log):
    wv = lambda *n: sum(W[:, BI[x]] for x in n)
    rng = g.rng; bvh = body_bvh(co, d)
    def plate(L, a, b, bone, mask=COLD, **k): shell(g, L, a, b, bone, col=PLATE, mask=mask, trim_col=EDGE, **k)
    def spike(p, tip, bone, w=0.03, side=(0, 0, 1), mask=SPIKE): blade(g, np.array(p), np.array(tip), side, w, {bone: 1.0}, col=EDGE, mask=mask, thick=0.008, n=3, belly=0.28)
    # the shoulders: heavy on both sides, a mantle of slag with its edge broken into spikes
    for s in 'LR':
        L = Limb(co, wv('arm_' + s) > 0.45, J['arm_' + s], J['fore_' + s], ns=40, na=30)
        o = np.array((0.0, 0.0, 1.0)) - L.u * L.u[2]; o /= np.linalg.norm(o); th = math.atan2(o @ L.e2, o @ L.e1)
        for (a, b, off, wd, rows) in ((0.22, 0.56, 0.022, 2.2, 4), (-0.24, 0.30, 0.040, 2.6, 5)):
            plate(L, a, b, 'arm_' + s, rows=rows, cols=10, off=off, a0=th - wd, a1=th + wd, closed=False, flare=lambda t: 0.02 * math.sin(t * math.pi))
        top = J['arm_' + s] + np.array((0.0, 0.0, 0.08))
        for k in range(3):
            base = top + np.array(((-1 if s == 'R' else 1) * (0.02 + 0.055 * k), 0.015 * k, -0.01 * k))
            spike(base, base + np.array(((-1 if s == 'R' else 1) * (0.05 + 0.03 * k), 0.03, 0.17 - 0.03 * k)), 'arm_' + s, w=0.034)
    log('shoulders', g.tris())
    # forearms and shins: the parts that swing and the parts that burn hottest, so they're armoured to the wrist and the ankle, with a fin down each
    for s in 'RL':
        L = Limb(co, wv('fore_' + s) > 0.5, J['fore_' + s], J['hand_' + s]); plate(L, 0.20, 0.92, 'fore_' + s, mask=WARM, rows=4, cols=10, off=0.012, flare=lambda t: 0.014 * t)
        L = Limb(co, wv('shin_' + s) > 0.5, J['shin_' + s], J['foot_' + s]); plate(L, 0.10, 0.82, 'shin_' + s, mask=WARM, rows=5, cols=10, off=0.014, flare=lambda t: 0.012 * math.sin(t * math.pi))
        kn = J['shin_' + s] + np.array((0.0, -0.075, 0.03)); spike(kn, kn + np.array((0.0, -0.12, 0.13)), 'shin_' + s, w=0.03, side=(1, 0, 0))
        el = J['fore_' + s] + np.array((0.0, 0.05, 0.0)); spike(el, el + np.array((0.0, 0.17, -0.04)), 'fore_' + s, w=0.03, side=(0, 0, 1))
    # the chest: two plates with the heart between them, and the back's ridge
    sel = (wv('spine_2', 'spine_3') > 0.4) & (np.abs(co[:, 0]) < 0.26)
    L = Limb(co, sel, (0, 0.01, 1.10), (0, 0.01, 1.54), ns=30, na=36)
    o = np.array((0.0, -1.0, 0.0)) - L.u * L.u[1] * -1.0; o /= np.linalg.norm(o); th = math.atan2(o @ L.e2, o @ L.e1)          # which way his front is, round this body
    for (a0, a1) in ((th + 0.20, th + 1.75), (th - 1.75, th - 0.20)):
        plate(L, 0.30, 0.90, 'spine_3', rows=6, cols=7, off=0.016, a0=a0, a1=a1, closed=False, flare=lambda t: 0.012 * math.sin(t * math.pi))
    sel = (wv('hips', 'spine_1') > 0.45) & (np.abs(co[:, 0]) < 0.3) & (co[:, 2] > 0.85)
    L = Limb(co, sel, (0, 0.0, 0.92), (0, 0.0, 1.14), ns=20, na=30); plate(L, 0.12, 0.84, 'hips', rows=3, cols=16, off=0.018, flare=lambda t: 0.02 * (1 - t))
    for k in range(7):
        t = k / 6; z = 1.54 - 0.46 * t
        hit = bvh.ray_cast(Vector((0.0, 1.0, z)), Vector((0, -1, 0)), 1.2)
        if hit[0] is None: continue
        p = np.array(tuple(hit[0])); h = (0.16 - 0.08 * t) * (0.85 + 0.3 * rng.random())
        spike(p + np.array((0, -0.012, 0)), p + np.array((0, h, h * 0.8)), 'spine_3' if z > 1.33 else 'spine_2' if z > 1.2 else 'spine_1', w=0.034)
    log('plates and ridge', g.tris())
    # the crown: horns swept back off the brow, the fire stands up through them
    head = J['head']
    for k in range(7):
        t = (k - 3) / 3.0
        o = Vector((t * 0.115, float(head[1]) - 0.07, float(head[2]) + 0.30)); hit = bvh.ray_cast(o, Vector((0, 0.12, -1)).normalized(), 0.5)
        if hit[0] is None: continue
        p = np.array(tuple(hit[0])); L_ = (0.26 - 0.11 * abs(t)) * (0.9 + 0.2 * rng.random())
        spike(p - np.array((0, 0, 0.01)), p + np.array((t * 0.09, L_ * 0.72, L_ * 0.78)), 'head', w=0.030, side=(1, 0, 0))
    log('crown', g.tris())
    # the eyes: real light, set in the sockets, so they read from across the water
    for e in eyes:
        e = np.array(e) + np.array((0, -0.016, 0))
        rows = [[tuple(e + np.array((math.cos(a) * r, zy, math.sin(a) * r * 0.5))) for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)] for r, zy in ((0.004, 0.012), (0.016, 0.0), (0.004, -0.012))]
        grid(g, rows, {'head': 1.0}, (1.0, 0.8, 0.5), GLOW, 'glow', closed=True, hard=False, cap0=True, cap1=True, uvscale=1.0)
    log('eyes', g.tris())
