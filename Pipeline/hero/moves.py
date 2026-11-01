# The Warden's moves, authored in code. Plain Python (no Blender, no numpy, nothing random at run time beyond SEED): Blender's build imports
# this, and `python3 moves.py <skeleton.json> <out moves.json>` runs alone. The skeleton comes in as data, so the same moves are solved
# again on any body: the Warden's, the Reaver's. Method after Colosseum/Pipeline/colosseum/anim.py (Catmull-Rom between keys, drag on the arms),
# grown for a skinned body: IK at the keys, per-joint delay (hips first, the trident last, the head before the hips), a spring on each
# joint for overshoot and the water's slow settle, and a lead hand that SLIDES along the shaft, frame by frame, as a real spear's does.
#
# A rotation is (pitch, yaw, roll) in degrees in the fighter's own axes: pitch about his right (+ swings a hanging limb forward, leans an upright
# one back), yaw about up (+ turns to his left), roll about forward (+ tilts an upright part to his right). A place or a direction is
# (right, forward, up). Fighter space is Blender's: he faces -y, his right is -x, up is z. Every joint's rotation is stored in axes aligned
# with the rest pose, so it is independent of how the bones were rolled; build_hero.py turns it into each bone's own axes.
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mocap_fit

SEED = 1931
FPS = 30

# ------------------------------------------------------------------ small maths
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def mul(a, s): return (a[0] * s, a[1] * s, a[2] * s)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def length(a): return math.sqrt(dot(a, a))
def unit(a):
    l = length(a)
    return (a[0] / l, a[1] / l, a[2] / l) if l > 1e-9 else (0.0, 0.0, 1.0)
def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def clamp(x, a, b): return a if x < a else b if x > b else x
def smooth(x): x = clamp(x, 0.0, 1.0); return x * x * (3 - 2 * x)

QI = (1.0, 0.0, 0.0, 0.0)
def qmul(a, b):
    aw, ax, ay, az = a; bw, bx, by, bz = b
    return (aw * bw - ax * bx - ay * by - az * bz, aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw)
def qconj(q): return (q[0], -q[1], -q[2], -q[3])
def qdot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
def qnorm(q):
    l = math.sqrt(qdot(q, q)); return (q[0] / l, q[1] / l, q[2] / l, q[3] / l)
def qrot(q, v):
    w, x, y, z = q; vx, vy, vz = v
    tx = 2 * (y * vz - z * vy); ty = 2 * (z * vx - x * vz); tz = 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)
def qaxis(axis, deg):
    h = math.radians(deg) * 0.5; s = math.sin(h); a = unit(axis)
    return (math.cos(h), a[0] * s, a[1] * s, a[2] * s)
def qexp(r):
    a = length(r)
    if a < 1e-9: return (1.0, r[0] * 0.5, r[1] * 0.5, r[2] * 0.5)
    s = math.sin(a * 0.5) / a
    return (math.cos(a * 0.5), r[0] * s, r[1] * s, r[2] * s)
def qlog(q):
    if q[0] < 0: q = (-q[0], -q[1], -q[2], -q[3])
    v = (q[1], q[2], q[3]); s = length(v)
    if s < 1e-9: return mul(v, 2.0)
    return mul(v, 2.0 * math.atan2(s, q[0]) / s)
def qslerp(a, b, t):
    if qdot(a, b) < 0: b = (-b[0], -b[1], -b[2], -b[3])
    return qnorm(qmul(qexp(mul(qlog(qmul(b, qconj(a))), t)), a))
def qfrommat(m):
    # m is three columns
    (a, d, g), (b, e, h), (c, f, i) = m
    tr = a + e + i
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2; return qnorm((0.25 * s, (h - f) / s, (c - g) / s, (d - b) / s))
    if a > e and a > i:
        s = math.sqrt(1.0 + a - e - i) * 2; return qnorm(((h - f) / s, 0.25 * s, (b + d) / s, (c + g) / s))
    if e > i:
        s = math.sqrt(1.0 + e - a - i) * 2; return qnorm(((c - g) / s, (b + d) / s, 0.25 * s, (f + h) / s))
    s = math.sqrt(1.0 + i - a - e) * 2; return qnorm(((d - b) / s, (c + g) / s, (f + h) / s, 0.25 * s))
def qframes(f0, f1):
    """The rotation taking the orthonormal frame f0 (three vectors) to f1."""
    # M = F1 * transpose(F0)
    def col(k): return tuple(sum(f1[n][r] * f0[n][k] for n in range(3)) for r in range(3))
    return qfrommat((col(0), col(1), col(2)))
def frame2(a, b):
    """An orthonormal frame from a (kept) and b (made perpendicular to it)."""
    a = unit(a); b = unit(sub(b, mul(a, dot(a, b))))
    return (a, b, cross(a, b))

RIGHT, FWD, UP = (-1.0, 0.0, 0.0), (0.0, -1.0, 0.0), (0.0, 0.0, 1.0)
def rf(r, f, u): return (-r, -f, u)
def E(p=0.0, y=0.0, r=0.0): return qmul(qaxis(UP, y), qmul(qaxis(RIGHT, p), qaxis(FWD, r)))

# ------------------------------------------------------------------ the skeleton
PARENT = {'root': None, 'hips': 'root', 'spine_1': 'hips', 'spine_2': 'spine_1', 'spine_3': 'spine_2', 'neck': 'spine_3', 'head': 'neck',
          'clav_R': 'spine_3', 'arm_R': 'clav_R', 'fore_R': 'arm_R', 'hand_R': 'fore_R', 'weapon': 'hand_R',
          'clav_L': 'spine_3', 'arm_L': 'clav_L', 'fore_L': 'arm_L', 'hand_L': 'fore_L',
          'leg_R': 'hips', 'shin_R': 'leg_R', 'foot_R': 'shin_R', 'toe_R': 'foot_R',
          'leg_L': 'hips', 'shin_L': 'leg_L', 'foot_L': 'shin_L', 'toe_L': 'foot_L'}
ORDER = list(PARENT)          # parents first
KEYED = [b for b in ORDER if b != 'root']
TIP_LEN = 1.05

class Skel:
    """joints: {bone: (x, y, z)} at rest; grip_R/grip_L: the centre of each closed hand; shaft_R/shaft_L: the rod's direction through it, thumb side."""
    def __init__(s, data):
        s.pos = {k: tuple(v) for k, v in data['joints'].items()}
        s.off = {b: (sub(s.pos[b], s.pos[PARENT[b]]) if PARENT[b] else s.pos[b]) for b in ORDER}
        s.grip = {'R': tuple(data['grip_R']), 'L': tuple(data['grip_L'])}
        s.shaft = {'R': unit(data['shaft_R']), 'L': unit(data['shaft_L'])}
        s.bias = data.get('bias', {})        # a body's own lean, added to every pose (the Reaver's hunch)
        s.arm = {}
        for side in 'RL':
            a, f, h, g = s.pos['arm_' + side], s.pos['fore_' + side], s.pos['hand_' + side], s.grip[side]
            d1, d2 = unit(sub(f, a)), unit(sub(h, f))
            hinge = cross(d1, d2)
            if length(hinge) < 1e-3: hinge = cross(d1, FWD)
            hinge = unit(hinge)
            w2g = sub(g, h)
            s.arm[side] = dict(l1=length(sub(f, a)), l2=length(sub(h, f)), d1=d1, d2=d2, hinge=hinge, w2g=w2g,
                               hand=frame2(s.shaft[side], w2g))
        s.fan = unit(cross(s.shaft['R'], UP))         # the way the tines spread at rest
        s.leg = {}
        for side in 'RL':
            a, k, f = s.pos['leg_' + side], s.pos['shin_' + side], s.pos['foot_' + side]
            d1, d2 = unit(sub(k, a)), unit(sub(f, k)); hinge = cross(d1, d2)
            if length(hinge) < 1e-3 or hinge[0] < 0: hinge = (1.0, 0.0, 0.0)       # a knee folds the shin back
            s.leg[side] = dict(l1=length(sub(k, a)), l2=length(sub(f, k)), d1=d1, d2=d2, hinge=unit(hinge))
        f, t = s.pos['foot_R'], s.pos['toe_R']
        s.foot = dict(h=f[2], ball=abs(f[1] - t[1]), heel=0.058, r=abs(f[0]))     # ankle height, ankle to ball, ankle to heel

# ------------------------------------------------------------------ one pose: joint turns, arms solved to the places asked for
def fk_chain(sk, Q, chain, P0=(0.0, 0.0, 0.0), G0=QI):
    """Walk down a list of bones from root space: returns the last bone's (position, rotation)."""
    P, G = P0, G0
    for b in chain:
        P = add(P, qrot(G, sk.off[b])); G = qmul(G, Q.get(b, QI))
    return P, G

def two_bone(S, W, l1, l2, pole):
    v = sub(W, S); d = clamp(length(v), abs(l1 - l2) + 1e-3, (l1 + l2) * 0.9985); n = unit(v)
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    perp = sub(pole, mul(n, dot(pole, n)))
    if length(perp) < 1e-4: perp = sub(FWD, mul(n, dot(FWD, n)))
    perp = unit(perp)
    return add(add(S, mul(n, a)), mul(perp, h)), add(S, mul(n, d)), perp

def limb_angles(A, S, W, pole):
    """Upper and lower limb world turns for a root S and an end W: a real hinge at the elbow or knee (no twist between the two)."""
    El, W2, perp = two_bone(S, W, A['l1'], A['l2'], pole)
    d1, d2 = unit(sub(El, S)), unit(sub(W2, El))
    hinge = cross(d1, d2)
    if length(hinge) < 1e-3: hinge = cross(d1, mul(perp, -1.0))
    hinge = unit(hinge)
    G1 = qframes(frame2(A['d1'], cross(A['hinge'], A['d1'])), frame2(d1, cross(hinge, d1)))
    G2 = qframes(frame2(A['d2'], cross(A['hinge'], A['d2'])), frame2(d2, cross(hinge, d2)))
    return G1, G2, El, W2

def arm_angles(sk, side, S, W, pole): return limb_angles(sk.arm[side], S, W, pole)

def hand_turn(sk, side, f, t, fixed=False):
    """The hand's world turn: the rest shaft exactly along t, the rest wrist-to-grip line as near f as that allows. fixed: the fist's way round the shaft comes from the body, not the forearm, for carries that blend into each other."""
    A = sk.arm[side]; t = unit(t)
    f2 = sub(f, mul(t, dot(f, t)))
    # with the forearm along the shaft "square to the shaft" means nothing and the hand would spin: there it settles to a fixed way, knuckles forward and in
    ref = rf(-0.6, 0.6, 0.0) if side == 'R' else rf(0.6, 0.6, 0.0); r2 = sub(ref, mul(t, dot(ref, t)))
    if length(r2) < 1e-3: r2 = (t[1], t[2], t[0])
    k = 0.0 if fixed else smooth((length(f2) - 0.12) / 0.33)
    f3 = lerp(unit(r2), unit(f2) if length(f2) > 1e-6 else unit(r2), k)
    return qframes(A['hand'], frame2(t, f3))

# A forearm turns about 90° either way, and there's no twist bone in it, so past that the wrist wrings like a cloth. What a real arm does with a fist that has to point somewhere is swing the elbow round:
# the swing that keeps the turn in range, the nearest to the elbow the pose asked for.
TWIST_OK = 58.0
SWIVELS = (0, 25, -25, 50, -50, 75, -75, 100, -100, 125, -125, 150, -150)
ROLLS = (0.0, 40.0, -40.0, 80.0, -80.0, 120.0, -120.0)
def wrist_turn(sk, side, G2, Gh2):
    q = qmul(qconj(G2), Gh2); axis = unit(sk.off['hand_' + side]); v = (q[1], q[2], q[3]); p = dot(v, axis)
    a = 2 * math.degrees(math.atan2(p, q[0])); return (a + 180.0) % 360.0 - 180.0
def swung(n, pole, deg):
    """pole turned about the shoulder-to-wrist line."""
    return qrot(qaxis(n, deg), pole)
def elbow_swing(sk, side, S, pole, try_at):
    """try_at(pole) gives (G1, G2, El, W2, Gh2) for a pole; the pole whose wrist turn is in range, or as near as it comes."""
    best = None; n = unit(sub(try_at(pole, 0.0)[3], S))
    for roll in ROLLS:            # and the shaft can turn in the fist: the tines are squared up afterwards, whatever the fist did
        for deg in SWIVELS:
            r = try_at(swung(n, pole, deg) if deg else pole, roll); tw = abs(wrist_turn(sk, side, r[1], r[4]))
            cost = max(0.0, tw - TWIST_OK) * 1.0 + abs(deg) * 0.1 + abs(roll) * 0.14
            if best is None or cost < best[0]: best = (cost, r)
            if deg == 0 and roll == 0 and tw <= TWIST_OK: return r
    return best[1]

def clav_auto(side, updir, fwd, ku=0.30, kf=0.16):
    """The shoulder girdle follows the arm: lifted when the arm goes up, pushed forward when it reaches."""
    el = clamp(math.degrees(math.asin(clamp(updir, -1, 1))) * ku, -5.0, 26.0)
    pr = clamp(fwd * 22.0 * (kf / 0.16), -12.0, 18.0)
    return E(0, pr, -el) if side == 'R' else E(0, -pr, el)

def solve_arm(sk, side, spec, Q, G3, P3, Gh, Ph):
    """spec: g (the grip place), t (the shaft's way), e (which way the elbow goes), fr ('root', 'hips' or 'chest' for all three), or
    d1, d2 (upper arm and forearm ways in that frame) for a free arm; palm: the free hand's turn."""
    n = lambda b: b + '_' + side
    fr = spec.get('fr', 'root')
    Gf = {'root': QI, 'hips': Gh, 'chest': G3}[fr]
    Pf = {'root': (0.0, 0.0, 0.0), 'hips': Ph, 'chest': P3}[fr]
    point = lambda p: add(Pf, qrot(Gf, rf(*p)))
    way = lambda d: qrot(Gf, rf(*d))
    clav_off = sk.off[n('clav')]; arm_off = sk.off[n('arm')]
    Sx = add(add(P3, qrot(G3, clav_off)), qrot(G3, arm_off))
    pole = way(spec.get('e', (0.55, -0.15, -0.8)))
    if 'g' in spec:
        g = point(spec['g'])
        aim = unit(sub(g, Sx))
    else:
        aim = way(spec['d1']); g = None
    Qc = clav_auto(side, aim[2], -aim[1], spec.get('ku', 0.30))
    Q[n('clav')] = Qc
    Gc = qmul(G3, Qc)
    C = add(P3, qrot(G3, clav_off)); S = add(C, qrot(Gc, arm_off))
    if g is not None and 't' in spec:      # a hand round a shaft
        t = way(spec['t']); f0 = unit(sub(g, S))
        fx = spec.get('fixed', False)
        def at(pl, roll):
            f = f0; q = qaxis(t, roll)
            for _ in range(4):
                Gh2 = qmul(q, hand_turn(sk, side, f, t, fx))
                W = sub(g, qrot(Gh2, sk.arm[side]['w2g']))
                G1, G2, El, W2 = arm_angles(sk, side, S, W, pl)
                f = unit(sub(W2, El))
            return G1, G2, El, W2, qmul(q, hand_turn(sk, side, f, t, fx))
        G1, G2, El, W2, Gh2 = elbow_swing(sk, side, S, pole, at)
    else:
        if g is not None:                  # a free hand: g is the wrist
            G1, G2, El, W2 = arm_angles(sk, side, S, g, pole)
        else:
            A = sk.arm[side]; d1, d2 = way(spec['d1']), way(spec['d2'])
            W = add(add(S, mul(d1, A['l1'])), mul(d2, A['l2']))
            G1, G2, El, W2 = arm_angles(sk, side, S, W, sub(mul(d1, 1.0), mul(d2, 1.0)))
        Gh2 = qmul(G2, E(*spec.get('palm', (0, 0, 0))))
    Q[n('arm')] = qmul(qconj(Gc), G1)
    Q[n('fore')] = qmul(qconj(G1), G2)
    Q[n('hand')] = qmul(qconj(G2), Gh2)

def leg_turns(Q, side, l):
    """l = (hip pitch, hip yaw, hip roll, knee, ankle, toe): knee and ankle pitch; a knee only bends one way (negative)."""
    n = lambda b: b + '_' + side
    Q[n('leg')] = E(l[0], l[1], l[2]); Q[n('shin')] = E(min(l[3], 0.0)); Q[n('foot')] = E(l[4]); Q[n('toe')] = E(l[5] if len(l) > 5 else 0.0)

IK_MISS = [0.0]
def solve_leg(sk, side, l, Q, Gh, Ph):
    """l: a = the ankle's place in fighter space (right, forward, up), p = the foot's pitch in space (+ toes up), t = the toes' bend, k = which way the knee points."""
    n = lambda b: b + '_' + side
    S = add(Ph, qrot(Gh, sk.off[n('leg')])); A = rf(*l['a'])
    G1, G2, K, W2 = limb_angles(sk.leg[side], S, A, rf(*l.get('k', (0.0, 1.0, 0.15))))
    IK_MISS[0] = max(IK_MISS[0], length(sub(W2, A)))
    Q[n('leg')] = qmul(qconj(Gh), G1); Q[n('shin')] = qmul(qconj(G1), G2)
    Q[n('foot')] = qmul(qconj(G2), E(l.get('p', 0.0), l.get('y', 0.0), 0.0)); Q[n('toe')] = E(l.get('t', 0.0))

def solve(sk, d):
    """A pose description to {bone: turn}, the hips' move and the lead hand's place on the shaft."""
    Q = {}
    b = sk.bias
    sp = add(tuple(d['spine']), tuple(b.get('spine', (0, 0, 0)))); hd = add(tuple(d['head']), tuple(b.get('head', (0, 0, 0))))
    Q['hips'] = E(*d['hips'])
    Q['spine_1'] = E(sp[0] * 0.28, sp[1] * 0.25, sp[2] * 0.3); Q['spine_2'] = E(sp[0] * 0.34, sp[1] * 0.35, sp[2] * 0.35)
    Q['spine_3'] = E(sp[0] * 0.38, sp[1] * 0.40, sp[2] * 0.35)
    Q['neck'] = E(hd[0] * 0.42, hd[1] * 0.45, hd[2] * 0.45); Q['head'] = E(hd[0] * 0.58, hd[1] * 0.55, hd[2] * 0.55)
    for k, v in d.get('fk', {}).items(): Q[k] = E(*v)
    off = rf(*d['off'])
    Ph = add(sk.pos['hips'], off); Gh = Q['hips']
    for side, key in (('R', 'legR'), ('L', 'legL')):
        if isinstance(d[key], dict): solve_leg(sk, side, d[key], Q, Gh, Ph)
        else: leg_turns(Q, side, d[key])
    P3, G3 = fk_chain(sk, Q, ['spine_1', 'spine_2', 'spine_3'], Ph, Gh)
    solve_arm(sk, 'R', d['R'], Q, G3, P3, Gh, Ph)
    solve_arm(sk, 'L', d['L'], Q, G3, P3, Gh, Ph)
    # the shaft turns freely in the fist: keep the tines broad across him, so it reads as a trident from anywhere, never edge-on as a spear
    Pc, Gc = fk_chain(sk, Q, ['clav_R', 'arm_R', 'fore_R', 'hand_R'], P3, G3)
    t = qrot(Gc, sk.shaft['R']); cur = qrot(Gc, sk.fan); across = qrot(Gh, RIGHT)
    want = sub(across, mul(t, dot(across, t)))
    if length(want) < 0.3:                           # the shaft lies across him: the tines stand upright instead
        want = sub(UP, mul(t, dot(UP, t)))
    want = unit(want)
    if dot(cur, want) < 0: want = mul(want, -1.0)
    Q['weapon'] = qaxis(sk.shaft['R'], math.degrees(math.atan2(dot(cross(cur, want), t), dot(cur, want))))
    return Q, off, tuple(d.get('grip', (0.0, 0.3)))

# ------------------------------------------------------------------ keys to frames
def cr_q(ts, qs, t):
    n = len(ts)
    if t <= ts[0]: return qs[0]
    if t >= ts[-1]: return qs[-1]
    i = 0
    while t >= ts[i + 1]: i += 1
    t1, t2 = ts[i], ts[i + 1]; q1, q2 = qs[i], qs[i + 1]
    t0, q0 = (ts[i - 1], qs[i - 1]) if i > 0 else (t1 - (t2 - t1), q1)
    t3, q3 = (ts[i + 2], qs[i + 2]) if i + 2 < n else (t2 + (t2 - t1), q2)
    a1 = qslerp(q0, q1, (t - t0) / (t1 - t0)); a2 = qslerp(q1, q2, (t - t1) / (t2 - t1)); a3 = qslerp(q2, q3, (t - t2) / (t3 - t2))
    b1 = qslerp(a1, a2, (t - t0) / (t2 - t0)); b2 = qslerp(a2, a3, (t - t1) / (t3 - t1))
    return qslerp(b1, b2, (t - t1) / (t2 - t1))

def cr_v(ts, vs, t):
    n = len(ts)
    if t <= ts[0]: return vs[0]
    if t >= ts[-1]: return vs[-1]
    i = 0
    while t >= ts[i + 1]: i += 1
    t1, t2 = ts[i], ts[i + 1]; p1, p2 = vs[i], vs[i + 1]
    t0, p0 = (ts[i - 1], vs[i - 1]) if i > 0 else (t1 - (t2 - t1), p1)
    t3, p3 = (ts[i + 2], vs[i + 2]) if i + 2 < n else (t2 + (t2 - t1), p2)
    a1 = lerp(p0, p1, (t - t0) / (t1 - t0)); a2 = lerp(p1, p2, (t - t1) / (t2 - t1)); a3 = lerp(p2, p3, (t - t2) / (t3 - t2))
    b1 = lerp(a1, a2, (t - t0) / (t2 - t0)); b2 = lerp(a2, a3, (t - t1) / (t3 - t1))
    return lerp(b1, b2, (t - t1) / (t2 - t1))

# how many seconds each joint comes after the hips in a blow: the hips first, then chest, shoulder, elbow, wrist; the head goes before them all
DELAY = {'hips': 0.0, 'spine_1': 0.016, 'spine_2': 0.033, 'spine_3': 0.05, 'neck': -0.03, 'head': -0.045,
         'clav_R': 0.066, 'arm_R': 0.083, 'fore_R': 0.116, 'hand_R': 0.15, 'weapon': 0.15,
         'clav_L': 0.066, 'arm_L': 0.09, 'fore_L': 0.125, 'hand_L': 0.15,
         'leg_R': 0.0, 'shin_R': 0.033, 'foot_R': 0.066, 'toe_R': 0.09, 'leg_L': 0.0, 'shin_L': 0.033, 'foot_L': 0.066, 'toe_L': 0.09}
# a spring on each joint (hertz, damping): stiff in the trunk, loose and heavy out at the ends; water makes everything settle slower
SPRING = {'hips': (6.5, 0.8), 'spine_1': (6.5, 0.75), 'spine_2': (6.0, 0.72), 'spine_3': (6.0, 0.7), 'neck': (6.0, 0.7), 'head': (5.5, 0.62),
          'clav_R': (6.0, 0.7), 'arm_R': (5.0, 0.62), 'fore_R': (5.0, 0.58), 'hand_R': (5.5, 0.55), 'weapon': (6.0, 0.6),
          'clav_L': (6.0, 0.7), 'arm_L': (4.5, 0.6), 'fore_L': (4.5, 0.55), 'hand_L': (4.5, 0.5),
          'leg_R': (3.6, 0.6), 'shin_R': (3.2, 0.52), 'foot_R': (3.2, 0.45), 'toe_R': (3.2, 0.4),
          'leg_L': (3.6, 0.6), 'shin_L': (3.2, 0.52), 'foot_L': (3.2, 0.45), 'toe_L': (3.2, 0.4)}

def spring_track(qs, hz, zeta, dt, sub_steps=4):
    """A joint carried on a damped spring towards its keyed turn: lag, overshoot, a slow settle. Works on turns of any size."""
    out = [qs[0]]; q = qs[0]; w = (0.0, 0.0, 0.0)
    k = (2 * math.pi * hz) ** 2; c = 2 * zeta * (2 * math.pi * hz); h = dt / sub_steps
    for i in range(1, len(qs)):
        for s in range(sub_steps):
            tgt = qslerp(qs[i - 1], qs[i], (s + 1) / sub_steps)
            e = qlog(qmul(tgt, qconj(q)))
            w = add(w, mul(sub(mul(e, k), mul(w, c)), h))
            q = qnorm(qmul(qexp(mul(w, h)), q))
        out.append(q)
    return out

def left_on_shaft(sk, Q, off, w, s, flip=False, pole=None):
    """The lead hand's place on the shaft for one frame: IK from where the shoulder is now to where the shaft is now."""
    if w <= 0.001: return
    Ph = add(sk.pos['hips'], off); Gh = Q['hips']
    P3, G3 = fk_chain(sk, Q, ['spine_1', 'spine_2', 'spine_3'], Ph, Gh)
    Pc, Gc = fk_chain(sk, Q, ['clav_R', 'arm_R', 'fore_R', 'hand_R'], P3, G3)
    g = add(Pc, qrot(Gc, sk.off['weapon'])); Gw = qmul(Gc, Q.get('weapon', QI))
    t = qrot(Gw, unit(sk.shaft['R']))
    tgt = add(g, mul(t, s))
    tt = mul(t, -1.0) if flip else t
    Cl, Gcl = fk_chain(sk, Q, ['clav_L'], P3, G3)
    S = add(Cl, qrot(Gcl, sk.off['arm_L']))
    pol = pole or add(qrot(G3, rf(-0.6, -0.1, -0.7)), (0, 0, -0.2))
    f0 = unit(sub(tgt, S))
    def at(pl, roll):
        f = f0; q = qaxis(tt, roll)
        for _ in range(4):
            Gh2 = qmul(q, hand_turn(sk, 'L', f, tt))
            W = sub(tgt, qrot(Gh2, sk.arm['L']['w2g']))
            G1, G2, El, W2 = arm_angles(sk, 'L', S, W, pl)
            f = unit(sub(W2, El))
        return G1, G2, El, W2, qmul(q, hand_turn(sk, 'L', f, tt))
    G1, G2, El, W2, Gh2 = elbow_swing(sk, 'L', S, pol, at)
    qa = qmul(qconj(Gcl), G1); qf = qmul(qconj(G1), G2); qh = qmul(qconj(G2), Gh2)
    Q['arm_L'] = qslerp(Q['arm_L'], qa, w); Q['fore_L'] = qslerp(Q['fore_L'], qf, w); Q['hand_L'] = qslerp(Q['hand_L'], qh, w)

def near_fan(sk, Qs):
    """The weapon's turn in the fist, pose after pose. Tines are the same turned by half a circle, so each pose takes whichever is nearest the one before: the shaft never spins to get there."""
    ax = sk.shaft['R']; last = None
    for Q in Qs:
        q = Q['weapon']; a = 2 * math.atan2(dot(q[1:], ax), q[0])
        if last is not None:
            a += math.pi * round((last - a) / math.pi)
        Q['weapon'] = qaxis(ax, math.degrees(a)); last = a

# What no joint passes in a clip, degrees a second: LIMIT outside a blow's active frames, LIMIT_BLOW inside. M3b's bound is 1,500 and M3c's 2,700; these sit under them with room for what a switch adds.
# A key pair that asks for more is held to this and catches up in the frames after. That's the motion being fixed, not a clip being marked down: a joint takes the turn over more frames.
LIMIT, LIMIT_BLOW = 1150.0, 2400.0
def limit_track(qs, most):
    out = [qs[0]]; q = qs[0]
    for i in range(1, len(qs)):
        t = qs[i]
        if qdot(q, t) < 0: t = tuple(-x for x in t)
        a = 2 * math.acos(min(1.0, abs(qdot(q, t))))
        q = qslerp(q, t, most[i] / a) if a > most[i] else t
        out.append(q)
    return out

def blow_window(sk, c, first):
    """The frames a blow can hit: where the point is moving faster than 55% of its peak, looking from frame `first` on."""
    pts = tip_path(sk, c); sp = [length(sub(pts[i + 1], pts[i])) * FPS for i in range(c['n'])]
    peak = max(range(first, len(sp)), key=lambda i: sp[i]); top = sp[peak]; a = b = peak
    while a > first and sp[a - 1] > 0.55 * top: a -= 1
    while b < len(sp) - 1 and sp[b + 1] > 0.55 * top: b += 1
    return a, b, peak, sp, pts

ELBOW_MOST, KNEE_MOST = 149.5, 148.0
def hinge_turn(q, h):
    """The part of q about the hinge h, degrees."""
    a = 2 * math.degrees(math.atan2(dot((q[1], q[2], q[3]), h), q[0])); return (a + 180.0) % 360.0 - 180.0
def stops(sk, tracks):
    """After the springs: an elbow or a knee is a hinge. Nothing past straight, nothing past what it folds to, no turn about any other axis."""
    for s in 'RL':
        for bone, Jn, most in (('fore_' + s, sk.arm[s], ELBOW_MOST), ('shin_' + s, sk.leg[s], KNEE_MOST)):
            h = Jn['hinge']; a0 = math.degrees(math.acos(clamp(dot(Jn['d1'], Jn['d2']), -1.0, 1.0))) * (1 if dot(cross(Jn['d1'], Jn['d2']), h) >= 0 else -1)
            tr = tracks[bone]
            for i, q in enumerate(tr):
                ang = clamp(hinge_turn(q, h), 2.0 - a0, most - a0); r = qaxis(h, ang)
                tr[i] = r if dot((r[1], r[2], r[3]), (q[1], q[2], q[3])) + r[0] * q[0] >= 0 else tuple(-x for x in r)

def bake_keys(sk, spec):
    """A clip of keys: solve each key, sample with each joint's delay, run the springs, hold each joint to the limit, then put the lead hand on the shaft frame by frame."""
    keys = spec['keys']; dur = keys[-1][0]; n = int(round(dur * FPS)); dt = 1.0 / FPS
    solved = [(t, solve(sk, d)) for t, d in keys]
    ts = [k[0] for k in solved]
    drag = spec.get('drag', 1.0)
    near_fan(sk, [s[1][0] for s in solved])
    tracks = {}
    for b in KEYED:
        qs = [s[1][0].get(b, QI) for s in solved]
        for i in range(1, len(qs)):
            if qdot(qs[i - 1], qs[i]) < 0: qs[i] = tuple(-x for x in qs[i])
        delay = DELAY.get(b, 0.0) * drag
        tracks[b] = [cr_q(ts, qs, i * dt - delay) for i in range(n + 1)]
    if spec.get('spring', 1.0) > 0:
        for b in KEYED:
            hz, z = SPRING.get(b, (6.0, 0.7)); hz *= spec.get('spring', 1.0)
            tracks[b] = spring_track(tracks[b], hz, z, dt)
        settle = min(n, 8)                  # the last frames meet the last key exactly, so the next clip blends from a known pose
        last = {b: solved[-1][1][0].get(b, QI) for b in KEYED}
        for b in KEYED:
            for i in range(n - settle, n + 1):
                tracks[b][i] = qslerp(tracks[b][i], last[b], smooth((i - (n - settle)) / settle))
    offs = [cr_v(ts, [s[1][1] for s in solved], i * dt) for i in range(n + 1)]
    if isinstance(keys[0][1]['legR'], dict):
        for side, key in (('R', 'legR'), ('L', 'legL')):
            aa = [tuple(k[1][key]['a']) for k in keys]; pp = [(k[1][key].get('p', 0.0), k[1][key].get('t', 0.0), 0.0) for k in keys]
            kk = [tuple(k[1][key].get('k', (0.0, 1.0, 0.15))) for k in keys]
            for i in range(n + 1):
                t = i * dt; Q = {'x': 0}; pt = cr_v(ts, pp, t)
                solve_leg(sk, side, {'a': cr_v(ts, aa, t), 'p': pt[0], 't': pt[1], 'k': cr_v(ts, kk, t)}, Q, tracks['hips'][i], add(sk.pos['hips'], offs[i]))
                for b in ('leg_', 'shin_', 'foot_', 'toe_'): tracks[b + side][i] = Q[b + side]
    # the limit, per frame: a blow's own active frames are read from its point
    per = [math.radians(spec.get('limit', LIMIT)) / FPS] * (n + 2)
    if 'blow' in spec:
        a, b = blow_window(sk, {'n': n, 'q': tracks, 'off': offs}, int(spec['blow'] * FPS))[:2]
        for i in range(max(0, a - 2), min(n + 1, b + 2)): per[i] = math.radians(spec.get('top', LIMIT_BLOW)) / FPS
    for b in KEYED:
        if b not in ('arm_L', 'fore_L', 'hand_L'): tracks[b] = limit_track(tracks[b], per)
    gw = [s[1][2][0] for s in solved]; gs = [s[1][2][1] for s in solved]
    flip = spec.get('flip', False)
    for i in range(n + 1):
        Q = {b: tracks[b][i] for b in KEYED}
        t = i * dt
        w = clamp(cr_v(ts, [(x, 0, 0) for x in gw], t - 0.05)[0], 0.0, 1.0)
        s = cr_v(ts, [(x, 0, 0) for x in gs], t - 0.03)[0]
        left_on_shaft(sk, Q, offs[i], w, s, flip)
        for b in ('arm_L', 'fore_L', 'hand_L'): tracks[b][i] = Q[b]
    base = [math.radians(spec.get('limit', LIMIT)) / FPS] * (n + 2)                 # the free arm has no blow to land
    for b in ('arm_L', 'fore_L', 'hand_L'): tracks[b] = limit_track(tracks[b], per if spec.get('lead_L') else base)
    stops(sk, tracks)
    return {'n': n, 'q': tracks, 'off': offs, 'blow': spec.get('blow')}

def bake_proc(sk, fn, n):
    """A loop: one pose per frame from a phase, frame n is frame 0 again, exactly."""
    tracks = {b: [] for b in KEYED}; offs = []; poses = []
    for i in range(n):
        d = fn(i / n)
        Q, off, grip = solve(sk, d)
        left_on_shaft(sk, Q, off, grip[0], grip[1], pole=d.get('polL'))
        poses.append(Q); offs.append(off)
    near_fan(sk, poses)
    for Q in poses:
        for b in KEYED: tracks[b].append(Q.get(b, QI))
    per = [math.radians(LIMIT) / FPS] * (2 * n + 2)
    for b in KEYED:
        two = limit_track(tracks[b] * 2, per)            # round twice, keeping the second turn, so it joins up where it loops
        tracks[b] = two[n:2 * n] + [two[n]]
        for i in range(1, n + 1):
            if qdot(tracks[b][i - 1], tracks[b][i]) < 0: tracks[b][i] = tuple(-x for x in tracks[b][i])
    stops(sk, tracks)
    offs.append(offs[0])
    return {'n': n, 'q': tracks, 'off': offs}

# ------------------------------------------------------------------ the guard: what every fight starts from and comes back to.
# A spear man's stance in water: left shoulder to the enemy, the rear hand low at the right hip holding the point of balance, the lead hand
# out on the shaft, head square to the target, the legs a slow split that keeps him up.
GUARD = {'hips': (-5, -24, 0), 'off': (0.0, 0.03, -0.07), 'spine': (-10, -12, 0), 'head': (13, 34, 0),
         'R': {'g': (0.24, 0.12, 1.00), 't': (-0.04, 1.0, 0.20), 'e': (0.75, -0.35, -0.55)},
         'L': {'g': (-0.10, 0.50, 1.20), 'e': (-0.7, 0.0, -0.7)},
         'legR': (-22, 4, 6, -44, -34, 0), 'legL': (40, -6, -6, -58, -24, 0), 'grip': (1.0, 0.46)}
def P(**over):
    d = dict(GUARD); d.update(over); return d

# ------------------------------------------------------------------ fights
def fight_clips():
    C = {}
    # THRUST. The hips open first, the rear hand drives along the line of the shaft through the lead hand (which hardly moves), the rear leg
    # kicks out long behind. The lead hand's place on the shaft closes from 0.62 to 0.08 m: that slide is what a real spear does.
    C['atk1'] = dict(loop=False, blow=0.1, limit=1090.0, keys=[
        (0.00, P()),
        (0.13, P(hips=(6, -40, 0), off=(0.02, -0.07, -0.04), spine=(4, -22, 0), head=(-4, 58, 0),
                 R={'g': (0.29, -0.14, 1.07), 't': (-0.02, 1.0, 0.13), 'e': (0.8, -0.5, -0.4)},
                 legR=(-4, 4, 5, -52, -24, 0), legL=(44, -8, -6, -60, -18, 0), grip=(1.0, 0.64))),
        (0.27, P(hips=(-10, 14, 0), off=(0.0, 0.16, 0.0), spine=(-16, 16, 0), head=(6, -22, 0),
                 R={'g': (0.05, 0.60, 1.30), 't': (0.0, 1.0, 0.04), 'e': (0.9, -0.1, -0.45)},
                 legR=(-36, 2, 4, -8, -58, -10), legL=(46, -8, -6, -44, -24, 0), grip=(1.0, 0.13))),
        (0.36, P(hips=(-12, 22, 0), off=(0.0, 0.18, 0.0), spine=(-18, 22, 0), head=(8, -34, 0),
                 R={'g': (0.0, 0.66, 1.31), 't': (0.02, 1.0, 0.02), 'e': (0.9, -0.1, -0.45)},
                 legR=(-40, 2, 4, -14, -58, -10), legL=(40, -8, -6, -40, -24, 0), grip=(1.0, 0.11))),
        (0.54, P(hips=(-4, 2, 0), off=(0.0, 0.08, -0.02), spine=(-10, 0, 0), head=(2, 6, 0),
                 R={'g': (0.17, 0.30, 1.16), 't': (0.0, 1.0, 0.10), 'e': (0.8, -0.2, -0.5)},
                 legR=(-24, 3, 5, -26, -44, 0), legL=(36, -7, -6, -42, -24, 0), grip=(1.0, 0.28))),
        (0.82, P())])
    # WIDE SWEEP. Coil right until the shaft lies behind the shoulder, the hips unwind first, the chest after them, and the arms come last and
    # fast, the lead hand pulling the butt in as the point goes out. The tip travels well over 180 degrees.
    C['atk2'] = dict(loop=False, drag=1.1, blow=0.1, keys=[
        (0.00, P()),
        (0.17, P(hips=(6, -64, -4), off=(0.05, -0.06, -0.05), spine=(2, -46, 6), head=(-4, 96, 0),
                 R={'g': (0.46, -0.26, 1.34), 't': (0.86, -0.32, 0.24), 'e': (0.7, -0.6, -0.35), 'fr': 'root'},
                 legR=(-2, 8, 8, -58, -22, 0), legL=(48, -16, -8, -64, -18, 0), grip=(1.0, 0.30))),
        (0.31, P(hips=(-4, -6, 2), off=(0.0, 0.06, -0.06), spine=(-8, 6, -4), head=(0, 20, 0),
                 R={'g': (0.34, 0.50, 1.30), 't': (0.62, 0.76, 0.06), 'e': (0.9, -0.1, -0.4)},
                 legR=(-30, 4, 6, -22, -50, -6), legL=(40, -10, -6, -48, -22, 0), grip=(1.0, 0.24))),
        (0.42, P(hips=(-8, 46, 4), off=(-0.03, 0.12, -0.05), spine=(-12, 42, -6), head=(4, -56, 0),
                 R={'g': (-0.30, 0.56, 1.26), 't': (-0.78, 0.60, 0.02), 'e': (0.7, 0.2, -0.65)},
                 legR=(-40, 2, 10, -10, -60, -10), legL=(30, -6, -10, -32, -28, 0), grip=(1.0, 0.22))),
        (0.56, P(hips=(-6, 66, 4), off=(-0.04, 0.10, -0.04), spine=(-8, 50, -6), head=(2, -76, 0),
                 R={'g': (-0.42, 0.18, 1.20), 't': (-0.86, -0.42, -0.08), 'e': (0.5, 0.6, -0.6)},
                 legR=(-30, 2, 10, -30, -50, 0), legL=(24, -6, -10, -36, -28, 0), grip=(1.0, 0.25))),
        (0.80, P(hips=(0, 16, 0), off=(0.0, 0.04, -0.03), spine=(-6, 10, 0), head=(0, -6, 0),
                 R={'g': (0.08, 0.26, 1.10), 't': (-0.16, 0.96, 0.12), 'e': (0.8, -0.1, -0.55)},
                 legR=(-20, 3, 6, -32, -38, 0), legL=(30, -6, -6, -40, -26, 0), grip=(1.0, 0.38))),
        (1.06, P())])
    # THE SLAM. Combat's count: contact by 0.4 s. A gather, the trident up over him in both hands, the hips snap, the chest folds and the arms drive the point down through the target.
    high = {'g': (0.10, -0.06, 2.00), 't': (0.0, 0.40, 0.92), 'e': (0.85, 0.0, 0.25)}
    C['atk3'] = dict(loop=False, drag=0.55, blow=0.16, keys=[
        (0.00, P()),
        (0.12, P(hips=(8, -38, 0), off=(0.0, -0.04, -0.12), spine=(-10, -24, 0), head=(-6, 52, 0),
                 R={'g': (0.42, -0.08, 1.30), 't': (0.46, 0.34, 0.82), 'e': (0.8, -0.3, -0.3)},
                 legR=(16, 6, 8, -80, -18, 0), legL=(60, -10, -8, -90, -14, 0), grip=(1.0, 0.34))),
        (0.25, P(hips=(10, -8, 0), off=(0.0, -0.05, 0.06), spine=(20, -4, 0), head=(-20, 6, 0), R=high,
                 legR=(-14, 0, 8, -34, -50, 0), legL=(30, 0, -8, -60, -36, 0), grip=(1.0, 0.34))),
        (0.38, P(hips=(-20, 8, 0), off=(0.0, 0.14, -0.10), spine=(-32, 4, 0), head=(16, -4, 0),
                 R={'g': (0.08, 0.62, 1.02), 't': (0.0, 0.86, -0.50), 'e': (0.9, 0.1, -0.1)},
                 legR=(-44, 2, 6, -30, -50, 0), legL=(62, -4, -6, -70, -24, 0), grip=(1.0, 0.34))),
        (0.48, P(hips=(-24, 8, 0), off=(0.0, 0.16, -0.14), spine=(-40, 2, 0), head=(22, -2, 0),
                 R={'g': (0.05, 0.64, 0.84), 't': (0.0, 0.76, -0.64), 'e': (0.9, 0.1, -0.1)},
                 legR=(-48, 2, 6, -36, -50, 0), legL=(66, -4, -6, -78, -22, 0), grip=(1.0, 0.32))),
        (0.72, P(hips=(-14, 4, 0), off=(0.0, 0.10, -0.12), spine=(-26, 0, 0), head=(14, 0, 0),
                 R={'g': (0.10, 0.56, 0.96), 't': (0.0, 0.92, -0.38), 'e': (0.9, 0.0, -0.3)},
                 legR=(-34, 2, 6, -36, -44, 0), legL=(52, -4, -6, -66, -24, 0), grip=(1.0, 0.36))),
        (1.08, P())])
    # TORPEDO LUNGE. Coil, then the body lays out flat behind the point, legs long, one hard whip of the whole length; the code carries him forward.
    C['atk_dash'] = dict(loop=False, blow=0.1, keys=[
        (0.00, P()),
        (0.12, P(hips=(14, -30, 0), off=(0.0, -0.08, -0.08), spine=(-20, -16, 0), head=(-10, 44, 0),
                 R={'g': (0.26, -0.18, 1.02), 't': (0.0, 1.0, 0.06), 'e': (0.8, -0.4, -0.45)},
                 legR=(30, 4, 5, -92, -12, 0), legL=(66, -8, -5, -96, -10, 0), grip=(1.0, 0.66))),
        (0.24, P(hips=(-52, 4, 0), off=(0.0, 0.26, 0.10), spine=(-18, 0, 0), head=(34, 0, 0),
                 R={'g': (0.02, 1.05, 1.30), 't': (0.0, 1.0, 0.02), 'e': (0.9, 0.0, -0.3)},
                 legR=(16, 0, 3, -18, -60, -14), legL=(8, 0, -3, -32, -62, -14), grip=(1.0, 0.18))),
        (0.34, P(hips=(-72, 6, 0), off=(0.0, 0.34, 0.14), spine=(-8, 2, 0), head=(46, 0, 0),
                 R={'g': (0.0, 1.32, 1.36), 't': (0.0, 1.0, 0.0), 'e': (0.9, 0.0, -0.3)},
                 legR=(-2, 0, 3, -30, -66, -14), legL=(14, 0, -3, -14, -66, -14), grip=(1.0, 0.16))),
        (0.52, P(hips=(-76, 2, 0), off=(0.0, 0.34, 0.14), spine=(-4, 0, 0), head=(48, 0, 0),
                 R={'g': (0.0, 1.30, 1.35), 't': (0.0, 1.0, 0.0), 'e': (0.9, 0.0, -0.3)},
                 legR=(10, 0, 3, -10, -66, -14), legL=(-4, 0, -3, -26, -66, -14), grip=(1.0, 0.16))),
        (0.76, P(hips=(-34, -8, 0), off=(0.0, 0.16, 0.04), spine=(-12, -6, 0), head=(24, 16, 0),
                 R={'g': (0.12, 0.62, 1.20), 't': (0.0, 1.0, 0.08), 'e': (0.8, -0.2, -0.5)},
                 legR=(-4, 2, 4, -34, -46, 0), legL=(24, -4, -4, -46, -30, 0), grip=(1.0, 0.26))),
        (1.06, P())])
    # THE SAME LUNGE ON HIS FEET: the same beats, so the same frame data, but he stays over his legs: a long low thrust, not a body laid out in the water.
    def on_feet(k):
        t, d = k; d = dict(d); h0 = d['hips']; d['hips'] = (max(h0[0], -22), h0[1], h0[2]); o = d['off']; d['off'] = (o[0], min(o[1], 0.14), min(o[2], 0.0) - 0.06)
        return (t, d)
    C['atk_dash_land'] = dict(loop=False, blow=0.1, keys=[on_feet(k) for k in C['atk_dash']['keys']])
    # MAELSTROM. A full circle fast enough to pull the water after it: arms flung out, the trident long at arm's end, the hips dragging all of it round.
    spin = []
    arm_out = {'g': (0.70, 0.26, 0.42), 't': (0.84, 0.54, 0.02), 'e': (0.8, 0.2, -0.25), 'fr': 'hips'}      # places in the hips' frame: up is above the hips, so this is chest high
    lf = {'d1': (-0.84, 0.30, -0.45), 'd2': (-0.80, 0.56, -0.20), 'fr': 'hips'}
    spin.append((0.00, P()))
    spin.append((0.15, P(hips=(6, -66, 0), off=(0.0, -0.03, -0.10), spine=(-10, -32, 0), head=(-6, 80, 0),
                         R={'g': (0.54, -0.06, 1.16), 't': (0.90, 0.40, 0.14), 'e': (0.8, -0.2, -0.3)},
                         legR=(16, 6, 12, -84, -18, 0), legL=(54, -10, -12, -92, -16, 0), grip=(0.0, 0.3))))
    n_spin = 6
    for k in range(1, n_spin + 1):
        a = k / n_spin; y = -66 + (360 + 42) * a; tt = 0.15 + 0.54 * a
        spin.append((tt, P(hips=(-4, y, 0), off=(0.0, 0.02, -0.03 + 0.04 * math.sin(a * math.pi)), spine=(-8, 12, 0), head=(4, -6, 0),
                           R=arm_out, L=lf, legR=(-14, 0, 16, -30, -46, 0), legL=(18, 0, -16, -44, -38, 0), grip=(0.0, 0.3))))
    spin.append((0.84, P(hips=(0, 336 - 26 + 34, 0), off=(0.0, 0.02, -0.04), spine=(-8, 6, 0), head=(0, 10, 0),
                         R={'g': (0.30, 0.34, 1.12), 't': (0.2, 0.96, 0.1), 'e': (0.8, -0.2, -0.5)},
                         L={'g': (-0.36, 0.30, 1.05), 'e': (-0.8, -0.1, -0.5)},
                         legR=(-16, 3, 8, -34, -40, 0), legL=(30, -6, -8, -42, -26, 0), grip=(0.3, 0.42))))
    spin.append((1.14, P(hips=(GUARD['hips'][0], 360 + GUARD['hips'][1], 0))))
    C['atk_spin'] = dict(loop=False, drag=0.9, blow=0.1, keys=spin)
    # THE WAVE. Everything drawn in: elbows back, chest open, hips under; then both arms drive forward from the legs up, the whole body behind the palms.
    C['cast_wave'] = dict(loop=False, drag=1.0, blow=0.1, keys=[
        (0.00, P()),
        (0.34, P(hips=(16, 0, 0), off=(0.0, -0.14, -0.12), spine=(20, 0, 0), head=(-16, 0, 0),
                 R={'g': (0.40, -0.26, 1.24), 't': (0.66, 0.62, 0.42), 'e': (0.7, -0.8, -0.1)},          # the tines out to his right, clear of his face
                 L={'g': (-0.42, -0.24, 1.28), 'e': (-0.7, -0.8, -0.1), 'palm': (0, 0, 0)},
                 legR=(34, 8, 8, -96, -14, 0), legL=(64, -8, -8, -100, -12, 0), grip=(0.0, 0.3))),
        (0.54, P(hips=(-20, 0, 0), off=(0.0, 0.20, 0.03), spine=(-20, 0, 0), head=(14, 0, 0),
                 R={'g': (0.17, 0.74, 1.38), 't': (0.0, 0.97, 0.24), 'e': (0.9, -0.1, -0.4)},
                 L={'g': (-0.17, 0.74, 1.44), 'e': (-0.9, -0.1, -0.4), 'palm': (66, 0, 0)},
                 legR=(-42, 3, 6, -6, -62, -10), legL=(-12, -3, -6, -14, -60, -10), grip=(0.0, 0.3))),
        (0.66, P(hips=(-22, 0, 0), off=(0.0, 0.22, 0.04), spine=(-22, 0, 0), head=(16, 0, 0),
                 R={'g': (0.16, 0.78, 1.40), 't': (0.0, 0.97, 0.22), 'e': (0.9, -0.1, -0.4)},
                 L={'g': (-0.16, 0.78, 1.46), 'e': (-0.9, -0.1, -0.4), 'palm': (72, 0, 0)},
                 legR=(-46, 3, 6, -12, -62, -10), legL=(-16, -3, -6, -20, -60, -10), grip=(0.0, 0.3))),
        (0.92, P(hips=(-12, -8, 0), off=(0.0, 0.12, 0.0), spine=(-12, -6, 0), head=(10, 10, 0),
                 R={'g': (0.20, 0.46, 1.22), 't': (0.0, 0.98, 0.20), 'e': (0.85, -0.2, -0.5)},
                 L={'g': (-0.20, 0.46, 1.28), 'e': (-0.85, -0.2, -0.5), 'palm': (30, 0, 0)},
                 legR=(-26, 3, 6, -26, -48, 0), legL=(12, -3, -6, -36, -40, 0), grip=(0.0, 0.3))),
        (1.32, P())])
    # PARRY. Shaft snapped across the chest in both hands, wide apart, the elbows braced, the head down behind it; a jolt as the blow lands.
    block = dict(hips=(2, -8, 0), off=(0.0, -0.03, -0.06), spine=(-10, -6, 0), head=(10, 10, 0),
                 R={'g': (0.34, 0.34, 1.34), 't': (-0.93, 0.10, 0.36), 'e': (0.8, -0.1, -0.6)},
                 legR=(-6, 4, 6, -50, -30, 0), legL=(44, -6, -6, -62, -22, 0), grip=(1.0, 0.56))
    C['parry'] = dict(loop=False, spring=1.3, drag=0.5, keys=[
        (0.00, P()),
        (0.12, P(**block)),
        (0.20, P(**dict(block, off=(0.0, -0.08, -0.05), spine=(-2, -6, 0)))),
        (0.42, P(**block)),
        (0.74, P())])
    # STRUCK. The hit lands on the chest first: head and trident lag and whip; the water catches him and brings him slowly back.
    C['hit_front'] = dict(loop=False, drag=0.6, keys=[
        (0.00, P()),
        (0.09, P(hips=(10, -30, 4), off=(0.0, -0.12, -0.02), spine=(26, -22, 6), head=(24, 44, -8),
                 R={'g': (0.36, -0.10, 1.16), 't': (0.2, 0.9, 0.42), 'e': (0.8, -0.4, -0.4)},
                 L={'g': (-0.40, 0.08, 1.10), 'e': (-0.8, -0.2, -0.5)},
                 legR=(10, 4, 5, -50, -26, 0), legL=(50, -6, -5, -66, -18, 0), grip=(0.0, 0.3))),
        (0.24, P(hips=(6, -28, 2), off=(0.0, -0.09, -0.04), spine=(12, -18, 2), head=(12, 36, -2),
                 L={'g': (-0.30, 0.20, 1.10), 'e': (-0.8, -0.2, -0.5)}, grip=(0.2, 0.42))),
        (0.76, P())])
    C['hit_back'] = dict(loop=False, drag=0.6, keys=[
        (0.00, P()),
        (0.12, P(hips=(-20, -14, -4), off=(0.0, 0.14, 0.0), spine=(22, -10, -6), head=(-20, 20, 8),
                 R={'g': (0.34, 0.10, 1.26), 't': (0.1, 0.92, 0.38), 'e': (0.9, 0.1, -0.3)},
                 L={'g': (-0.44, 0.12, 1.24), 'e': (-0.9, 0.2, -0.3)},
                 legR=(-44, 4, 5, -40, -52, 0), legL=(-10, -6, -5, -52, -46, 0), grip=(0.0, 0.3))),
        (0.34, P(hips=(-10, -18, -2), off=(0.0, 0.08, -0.02), spine=(10, -12, -2), head=(-8, 26, 2),
                 L={'g': (-0.26, 0.26, 1.14), 'e': (-0.8, -0.2, -0.5)}, grip=(0.2, 0.42))),
        (0.76, P())])
    # DEATH. A last jolt, then every joint lets go: the spring softens to nothing, arms float up behind a body that sinks, chin to chest, the trident
    # still in the hand. The end pose is held (the code sinks him).
    limpR = {'d1': (0.66, 0.30, 0.40), 'd2': (0.70, 0.42, 0.56)}
    limpL = {'d1': (-0.60, 0.20, 0.55), 'd2': (-0.56, 0.36, 0.72), 'palm': (-20, 0, 0)}
    C['death'] = dict(loop=False, spring=0.55, drag=1.4, keys=[
        (0.00, P()),
        (0.12, P(hips=(10, -10, 4), off=(0.0, -0.10, 0.0), spine=(26, -6, 6), head=(26, 10, 12),
                 R={'g': (0.44, 0.10, 1.26), 't': (0.4, 0.8, 0.42), 'e': (0.8, -0.2, -0.4)},
                 L={'g': (-0.44, 0.12, 1.22), 'e': (-0.8, -0.2, -0.4)},
                 legR=(10, 4, 5, -46, -30, 0), legL=(40, -6, -5, -60, -24, 0), grip=(0.0, 0.3))),
        (0.70, P(hips=(-4, -4, 6), off=(0.0, -0.02, 0.02), spine=(-24, -4, 8), head=(34, 4, 16),
                 R=limpR, L=limpL, legR=(10, 8, 6, -52, -40, 0), legL=(28, -8, -6, -66, -40, 0), grip=(0.0, 0.3))),
        (1.60, P(hips=(-12, -2, 10), off=(0.0, 0.0, 0.03), spine=(-34, -2, 10), head=(40, 2, 22),
                 R=limpR, L=limpL, legR=(16, 10, 8, -60, -46, 0), legL=(36, -10, -8, -74, -46, 0), grip=(0.0, 0.3))),
        (3.00, P(hips=(-16, 0, 12), off=(0.0, 0.0, 0.04), spine=(-38, 0, 12), head=(42, 0, 26),
                 R=limpR, L=limpL, legR=(20, 10, 8, -64, -48, 0), legL=(40, -10, -8, -80, -48, 0), grip=(0.0, 0.3)))])
    # VICTORY. The trident driven straight up at arm's length, the free fist low, chest high, chin up, and held.
    up = {'g': (0.24, 0.04, 2.30), 't': (0.04, 0.0, 1.0), 'e': (0.9, 0.0, 0.0), 'ku': 0.5}
    C['victory'] = dict(loop=False, keys=[
        (0.00, P()),
        (0.30, P(hips=(8, 0, 0), off=(0.0, 0.0, -0.10), spine=(-12, 6, 0), head=(6, 0, 0),
                 R={'g': (0.30, 0.20, 1.20), 't': (0.0, 0.3, 0.95), 'e': (0.8, 0.0, -0.4)},
                 L={'g': (-0.30, 0.20, 1.02), 'e': (-0.8, 0.0, -0.5)},
                 legR=(16, 4, 5, -66, -26, 0), legL=(40, -4, -5, -72, -22, 0), grip=(0.0, 0.3))),
        (0.62, P(hips=(-6, 6, 0), off=(0.0, 0.0, 0.06), spine=(16, 8, 4), head=(-20, -6, 0),
                 R=up, L={'g': (-0.34, 0.06, 1.04), 'e': (-0.85, 0.1, -0.3)},
                 legR=(-12, 4, 5, -14, -60, -8), legL=(10, -4, -5, -30, -56, -8), grip=(0.0, 0.3))),
        (1.20, P(hips=(-4, 6, 0), off=(0.0, 0.0, 0.03), spine=(14, 8, 4), head=(-18, -6, 0),
                 R=up, L={'g': (-0.34, 0.08, 1.02), 'e': (-0.85, 0.1, -0.3)},
                 legR=(-10, 4, 5, -20, -56, -8), legL=(12, -4, -5, -36, -50, -8), grip=(0.0, 0.3))),
        (2.40, P(hips=(-5, 6, 0), off=(0.0, 0.0, 0.05), spine=(15, 8, 4), head=(-19, -6, 0),
                 R=up, L={'g': (-0.34, 0.08, 1.03), 'e': (-0.85, 0.1, -0.3)},
                 legR=(-12, 4, 5, -16, -58, -8), legL=(10, -4, -5, -32, -54, -8), grip=(0.0, 0.3)))])
    # TAKE IT. A dip from the waist, the left hand reaches down and in, closes, and brings it back to the chest.
    C['pick_up'] = dict(loop=False, keys=[
        (0.00, P()),
        (0.34, P(hips=(-18, 0, 0), off=(0.0, 0.06, -0.14), spine=(-44, 0, 0), head=(20, 0, 0),
                 R={'g': (0.34, 0.06, 1.02), 't': (0.0, 0.5, 0.86), 'e': (0.9, 0.0, -0.3)},
                 L={'g': (-0.10, 0.62, 0.62), 'e': (-0.8, 0.1, -0.2)},
                 legR=(10, 4, 5, -60, -30, 0), legL=(60, -4, -5, -84, -20, 0), grip=(0.0, 0.3))),
        (0.48, P(hips=(-20, 0, 0), off=(0.0, 0.06, -0.16), spine=(-48, 0, 0), head=(22, 0, 0),
                 R={'g': (0.34, 0.08, 1.00), 't': (0.0, 0.5, 0.86), 'e': (0.9, 0.0, -0.3)},
                 L={'g': (-0.08, 0.66, 0.56), 'e': (-0.8, 0.1, -0.2), 'palm': (46, 0, 0)},
                 legR=(12, 4, 5, -62, -30, 0), legL=(62, -4, -5, -86, -20, 0), grip=(0.0, 0.3))),
        (0.86, P(hips=(0, 0, 0), off=(0.0, 0.0, -0.05), spine=(2, 0, 0), head=(14, 0, 0),
                 R={'g': (0.34, 0.08, 1.08), 't': (0.0, 0.5, 0.86), 'e': (0.9, 0.0, -0.3)},
                 L={'g': (-0.10, 0.28, 1.34), 'e': (-0.9, -0.2, -0.4), 'palm': (50, 0, 0)},
                 legR=(-8, 4, 5, -34, -40, 0), legL=(30, -4, -5, -46, -28, 0), grip=(0.0, 0.3))),
        (1.30, P())])
    # THE BREACH. Streamlined up through the surface, the body arches over at the top of the arc, then pikes to go back in head first.
    stream = {'g': (0.03, 0.04, 2.34), 't': (0.0, 0.05, 1.0), 'e': (0.9, 0.0, 0.1), 'ku': 0.55}
    C['leap'] = dict(loop=False, keys=[
        (0.00, P(hips=(6, 0, 0), off=(0.0, 0.0, -0.06), spine=(-6, 0, 0), head=(24, 0, 0), R=stream,
                 legR=(16, 0, 2, -50, -56, -10), legL=(16, 0, -2, -50, -56, -10), grip=(1.0, 0.34))),
        (0.30, P(hips=(-14, 0, 0), off=(0.0, 0.03, 0.0), spine=(14, 0, 0), head=(24, 0, 0), R=stream,
                 legR=(-14, 0, 2, -4, -66, -14), legL=(-14, 0, -2, -4, -66, -14), grip=(1.0, 0.34))),
        (0.70, P(hips=(-14, 0, 0), off=(0.0, 0.05, 0.02), spine=(34, 0, 0), head=(30, 0, 0),
                 R={'g': (0.05, -0.24, 2.18), 't': (0.0, -0.40, 0.92), 'e': (0.9, 0.0, 0.1), 'ku': 0.55},
                 legR=(-22, 0, 3, -26, -66, -14), legL=(-22, 0, -3, -36, -66, -14), grip=(1.0, 0.34))),
        (1.00, P(hips=(24, 0, 0), off=(0.0, 0.0, 0.0), spine=(-24, 0, 0), head=(-6, 0, 0),
                 R={'g': (0.03, 0.34, 2.20), 't': (0.0, 0.42, 0.90), 'e': (0.9, 0.0, 0.1), 'ku': 0.55},
                 legR=(34, 0, 2, -14, -62, -10), legL=(34, 0, -2, -18, -62, -10), grip=(1.0, 0.34))),
        (1.30, P(hips=(14, 0, 0), off=(0.0, 0.0, -0.03), spine=(-10, 0, 0), head=(20, 0, 0), R=stream,
                 legR=(10, 0, 2, -6, -66, -14), legL=(10, 0, -2, -6, -66, -14), grip=(1.0, 0.34)))])
    return C

# ------------------------------------------------------------------ what combat asked for (Pipeline/hero/CLIP_REQUESTS.md). Times are its counts from the reference: a wind-up of 0.17-0.23 s at most, the blow's
# fastest moment at contact, the next action free soon after. Each is one shot, in place. On land these drive the trunk and arms, and the feet stay his own, except the stomp.
def power_clips(sk):
    C = {}; h = sk.foot['h']
    free = lambda **o: P(grip=(0.0, 0.3), **o)
    low = {'g': (0.30, 0.04, 0.98), 't': (-0.04, 0.98, 0.18), 'e': (0.8, -0.4, -0.5)}             # the trident held low while the free hand works
    # THE DODGE. In water a body in one long line (combat rolls him about his length); on land a low slip, weight carried forward, ending ready to strike.
    line_ = dict(hips=(0, 0, 0), off=(0.0, 0.0, 0.0), spine=(0, 0, 0), head=(0, 0, 0), R={'g': (0.04, 0.05, 0.90), 't': (0.0, 0.0, 1.0), 'e': (0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7},
                 L={'g': (-0.1, 0.0, 0.8), 'e': (-0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7}, legR=(4, 0, 1, -12, -62, -12), legL=(-4, 0, -1, -30, -62, -12), grip=(1.0, 0.13))
    C['dodge_water'] = dict(loop=False, spring=1.4, drag=0.35, limit=820.0, keys=[        # `limit`: combat plays a dodge 1.29 times as fast, and it starts from wherever he was

        (0.00, P()), (0.16, P(**line_)), (0.28, P(**dict(line_, legR=(-6, 0, 1, -28, -62, -12), legL=(8, 0, -1, -10, -62, -12)))), (0.42, P())])
    slip = dict(hips=(-16, -14, 0), off=(0.0, 0.10, -0.26), spine=(-26, -8, 0), head=(26, 16, 0), R=dict(low, g=(0.34, -0.04, 0.84)), L={'g': (-0.36, 0.20, 0.92), 'e': (-0.8, -0.3, -0.3)}, grip=(0.0, 0.3))
    C['dodge_land'] = dict(loop=False, spring=1.3, drag=0.35, limit=820.0, keys=[

        (0.00, P()), (0.11, P(**slip)), (0.22, P(**dict(slip, off=(0.0, 0.08, -0.20), spine=(-22, -6, 0)))), (0.42, P())])
    # RISING TIDE. A low sweep up through the foe, the whole body lifting after it: the trident ends high, ready for the air.
    C['launcher'] = dict(loop=False, drag=0.4, spring=1.3, blow=0.03, keys=[
        (0.00, P()),
        (0.05, P(hips=(10, -24, 0), off=(0.0, -0.04, -0.16), spine=(-16, -14, 0), head=(-6, 30, 0),
                 R={'g': (0.42, 0.20, 0.74), 't': (0.34, 0.90, -0.26), 'e': (0.8, -0.4, -0.3)}, legR=(20, 6, 6, -84, -18, 0), legL=(58, -8, -6, -92, -16, 0), grip=(1.0, 0.40))),
        (0.14, P(hips=(-14, 14, 0), off=(0.0, 0.08, 0.02), spine=(10, 10, 0), head=(-12, -8, 0),
                 R={'g': (0.20, 0.60, 1.62), 't': (0.04, 0.62, 0.78), 'e': (0.9, 0.0, -0.1)}, legR=(-26, 2, 4, -14, -60, -8), legL=(38, -4, -4, -56, -30, 0), grip=(1.0, 0.26))),
        (0.30, P(hips=(-10, 16, 0), off=(0.0, 0.04, 0.10), spine=(14, 12, 0), head=(-16, -10, 0),
                 R={'g': (0.16, 0.30, 2.04), 't': (0.04, 0.20, 0.98), 'e': (0.9, 0.0, 0.1), 'ku': 0.55}, legR=(-20, 2, 4, -20, -60, -8), legL=(30, -4, -4, -66, -30, 0), grip=(1.0, 0.30))),
        (0.55, P(hips=(-8, 12, 0), off=(0.0, 0.03, 0.08), spine=(12, 10, 0), head=(-12, -8, 0),
                 R={'g': (0.18, 0.28, 1.98), 't': (0.06, 0.24, 0.97), 'e': (0.9, 0.0, 0.1), 'ku': 0.55}, legR=(-14, 2, 4, -30, -56, -8), legL=(24, -4, -4, -60, -34, 0), grip=(1.0, 0.30)))])
    # TWO CUTS IN THE AIR. Nothing under him: the legs trail behind each one. The first falls right to left, the second comes back left to right and up.
    trail = dict(legR=(-20, 0, 4, -34, -52, -8), legL=(-6, 0, -4, -52, -50, -8))
    bal1 = {'g': (-0.56, -0.10, 1.34), 'e': (-0.7, -0.4, -0.4), 'palm': (0, 0, 0)}; bal2 = {'g': (-0.52, 0.20, 1.20), 'e': (-0.8, -0.2, -0.4), 'palm': (0, 0, 0)}
    C['air1'] = dict(loop=False, drag=0.4, spring=1.2, blow=0.03, top=1120.0, keys=[
        (0.00, P(hips=(4, 10, 0), off=(0.0, 0.0, 0.02), spine=(10, 10, 0), head=(-8, -8, 0), R={'g': (0.22, 0.24, 1.86), 't': (0.20, 0.34, 0.92), 'e': (0.9, 0.0, 0.1)}, L=bal1, grip=(0.0, 0.3), **trail)),
        (0.07, P(hips=(6, 22, 0), off=(0.0, -0.02, 0.04), spine=(12, 20, 0), head=(-10, -22, 0), R={'g': (0.42, 0.10, 1.72), 't': (0.46, 0.20, 0.86), 'e': (0.8, -0.3, 0.1)}, L=bal1, grip=(0.0, 0.3), **trail)),
        (0.17, P(hips=(-10, -14, 0), off=(0.0, 0.08, 0.0), spine=(-14, -16, 0), head=(10, 18, 0), R={'g': (0.02, 0.64, 1.20), 't': (-0.36, 0.86, -0.36), 'e': (0.8, 0.1, -0.5)}, L=bal2, grip=(0.0, 0.3), **trail)),
        (0.28, P(hips=(-12, -24, 0), off=(0.0, 0.06, -0.02), spine=(-16, -22, 0), head=(12, 28, 0), R={'g': (-0.14, 0.48, 1.06), 't': (-0.56, 0.72, -0.40), 'e': (0.7, 0.3, -0.6)}, L=bal2, grip=(0.0, 0.3), **trail)),
        (0.42, P(hips=(-6, -20, 0), off=(0.0, 0.03, 0.0), spine=(-10, -16, 0), head=(6, 22, 0), R={'g': (-0.08, 0.44, 1.12), 't': (-0.44, 0.84, -0.30), 'e': (0.7, 0.3, -0.6)}, L=bal2, grip=(0.0, 0.3), **trail))])
    C['air2'] = dict(loop=False, drag=0.4, spring=1.2, blow=0.03, top=1120.0, keys=[
        (0.00, P(hips=(-6, -20, 0), off=(0.0, 0.03, 0.0), spine=(-10, -16, 0), head=(6, 22, 0), R={'g': (-0.08, 0.44, 1.12), 't': (-0.44, 0.84, -0.30), 'e': (0.7, 0.3, -0.6)}, L=bal2, grip=(0.0, 0.3), **trail)),
        (0.07, P(hips=(-2, -30, 0), off=(0.0, 0.0, -0.02), spine=(-8, -24, 0), head=(4, 30, 0), R={'g': (-0.22, 0.30, 1.08), 't': (-0.66, 0.60, -0.44), 'e': (0.7, 0.3, -0.6)}, L=bal2, grip=(0.0, 0.3), **trail)),
        (0.17, P(hips=(-10, 12, 0), off=(0.0, 0.08, 0.04), spine=(6, 14, 0), head=(-6, -14, 0), R={'g': (0.26, 0.62, 1.50), 't': (0.44, 0.84, 0.32), 'e': (0.9, 0.0, -0.3)}, L=bal1, grip=(0.0, 0.3), **trail)),
        (0.28, P(hips=(-8, 24, 0), off=(0.0, 0.05, 0.06), spine=(10, 22, 0), head=(-10, -24, 0), R={'g': (0.42, 0.34, 1.68), 't': (0.64, 0.44, 0.63), 'e': (0.9, -0.2, -0.1)}, L=bal1, grip=(0.0, 0.3), **trail)),
        (0.42, P(hips=(-4, 16, 0), off=(0.0, 0.03, 0.04), spine=(8, 14, 0), head=(-6, -14, 0), R={'g': (0.32, 0.30, 1.60), 't': (0.46, 0.36, 0.81), 'e': (0.9, -0.2, -0.2)}, L=bal1, grip=(0.0, 0.3), **trail))])
    # THE PLUNGE. A beat hung at the top, knees up, the trident reversed in both hands; then the body opens and drives down behind its point. The last pose holds for the fall.
    drive = dict(hips=(-6, 0, 0), off=(0.0, 0.02, 0.06), spine=(-14, 0, 0), head=(26, 0, 0), R={'g': (0.08, 0.24, 0.78), 't': (0.0, 0.14, -0.99), 'e': (0.85, -0.2, -0.3)},
                 L={'g': (-0.14, 0.26, 0.96), 'e': (-0.85, -0.2, -0.3)}, legR=(-10, 0, 3, -14, -62, -10), legL=(-20, 0, -3, -10, -62, -10), grip=(1.0, 0.12))
    C['plunge'] = dict(loop=False, drag=0.3, spring=1.4, keys=[
        (0.00, P(hips=(8, 0, 0), off=(0.0, -0.02, 0.10), spine=(14, 0, 0), head=(-8, 0, 0), R={'g': (0.12, 0.10, 1.94), 't': (0.0, 0.30, -0.95), 'e': (0.85, 0.0, 0.2)},
                 legR=(60, 0, 4, -100, -36, 0), legL=(66, 0, -4, -104, -36, 0), grip=(1.0, 0.22))),
        (0.14, P(hips=(10, 0, 0), off=(0.0, -0.02, 0.12), spine=(16, 0, 0), head=(-10, 0, 0), R={'g': (0.12, 0.08, 1.98), 't': (0.0, 0.30, -0.95), 'e': (0.85, 0.0, 0.2)},
                 legR=(64, 0, 4, -106, -36, 0), legL=(70, 0, -4, -110, -36, 0), grip=(1.0, 0.22))),
        (0.30, P(**drive))])
    # ... AND ITS LANDING. The point in the ground, the body down over it, then up out of it.
    C['plunge_land'] = dict(loop=False, drag=0.3, spring=1.4, keys=[
        (0.00, P(hips=(-22, 0, 0), off=(0.0, 0.10, -0.16), spine=(-34, 0, 0), head=(24, 0, 0), R={'g': (0.08, 0.40, 0.70), 't': (0.0, 0.20, -0.98), 'e': (0.85, -0.2, -0.2)},
                 L={'g': (-0.12, 0.40, 0.86), 'e': (-0.85, -0.2, -0.2)}, grip=(1.0, 0.12))),
        (0.14, P(hips=(-20, 0, 0), off=(0.0, 0.08, -0.14), spine=(-30, 0, 0), head=(16, 0, 0), R={'g': (0.08, 0.40, 0.74), 't': (0.0, 0.20, -0.98), 'e': (0.85, -0.2, -0.2)},
                 L={'g': (-0.12, 0.40, 0.90), 'e': (-0.85, -0.2, -0.2)}, grip=(1.0, 0.14))),
        (0.37, P())])
    # THE RIPOSTE. Out of the parry's shaft-across-the-chest, straight down the line with the whole body behind it.
    C['riposte'] = dict(loop=False, drag=0.22, spring=1.6, blow=0.03, keys=[
        (0.00, P(hips=(6, -22, 0), off=(0.0, -0.05, -0.06), spine=(-6, -14, 0), head=(10, 20, 0), R={'g': (0.30, -0.06, 1.14), 't': (-0.06, 0.98, 0.16), 'e': (0.8, -0.4, -0.5)}, grip=(1.0, 0.60))),
        (0.13, P(hips=(-12, 22, 0), off=(0.0, 0.18, 0.0), spine=(-18, 22, 0), head=(8, -34, 0), R={'g': (0.0, 0.70, 1.31), 't': (0.02, 1.0, 0.02), 'e': (0.9, -0.1, -0.45)}, legR=(-40, 2, 4, -14, -58, -10), legL=(40, -8, -6, -40, -24, 0), grip=(1.0, 0.11))),
        (0.22, P(hips=(-10, 20, 0), off=(0.0, 0.16, 0.0), spine=(-16, 20, 0), head=(6, -30, 0), R={'g': (0.02, 0.64, 1.28), 't': (0.02, 1.0, 0.03), 'e': (0.9, -0.1, -0.45)}, legR=(-36, 2, 4, -18, -56, -8), legL=(38, -8, -6, -40, -24, 0), grip=(1.0, 0.12))),
        (0.50, P())])
    # TWO FINISHERS, each two beats. Water: a sweep across and a thrust through. Ice: an overhead chop, then the point driven down.
    C['finisher_water'] = dict(loop=False, drag=0.35, spring=1.3, blow=0.03, keys=[
        (0.00, P()),
        (0.05, P(hips=(6, -46, -4), off=(0.05, -0.04, -0.05), spine=(2, -36, 6), head=(-4, 70, 0), R={'g': (0.46, -0.02, 1.30), 't': (0.86, 0.10, 0.24), 'e': (0.7, -0.6, -0.35)}, grip=(1.0, 0.30))),
        (0.17, P(hips=(-8, 40, 4), off=(-0.02, 0.12, -0.05), spine=(-12, 36, -6), head=(4, -48, 0), R={'g': (-0.28, 0.56, 1.26), 't': (-0.78, 0.60, 0.02), 'e': (0.7, 0.2, -0.65)}, legR=(-40, 2, 10, -10, -60, -10), legL=(30, -6, -10, -32, -28, 0), grip=(1.0, 0.22))),
        (0.36, P(hips=(8, -30, 0), off=(0.0, -0.06, -0.08), spine=(4, -22, 0), head=(-4, 40, 0), R={'g': (0.30, -0.10, 1.10), 't': (-0.02, 1.0, 0.12), 'e': (0.8, -0.5, -0.4)}, legR=(-4, 4, 5, -52, -24, 0), legL=(44, -8, -6, -60, -18, 0), grip=(1.0, 0.62))),
        (0.48, P(hips=(-14, 24, 0), off=(0.0, 0.20, 0.0), spine=(-20, 24, 0), head=(10, -36, 0), R={'g': (0.0, 0.76, 1.32), 't': (0.02, 1.0, 0.02), 'e': (0.9, -0.1, -0.45)}, legR=(-44, 2, 4, -12, -60, -10), legL=(44, -8, -6, -38, -24, 0), grip=(1.0, 0.11))),
        (0.77, P())])
    over_ = {'g': (0.10, 0.04, 2.02), 't': (0.0, 0.46, 0.89), 'e': (0.85, 0.0, 0.25)}
    C['finisher_ice'] = dict(loop=False, drag=0.35, spring=1.3, blow=0.03, keys=[
        (0.00, P(R=dict(over_, g=(0.14, 0.04, 1.90)), hips=(8, -6, 0), off=(0.0, -0.04, 0.04), spine=(16, -4, 0), head=(-14, 4, 0), legR=(-14, 0, 8, -34, -50, 0), legL=(30, 0, -8, -60, -36, 0), grip=(1.0, 0.34))),
        (0.05, P(R=over_, hips=(10, -8, 0), off=(0.0, -0.05, 0.06), spine=(20, -4, 0), head=(-20, 6, 0), legR=(-14, 0, 8, -34, -50, 0), legL=(30, 0, -8, -60, -36, 0), grip=(1.0, 0.34))),
        (0.17, P(hips=(-20, 8, 0), off=(0.0, 0.14, -0.10), spine=(-32, 4, 0), head=(16, -4, 0), R={'g': (0.08, 0.62, 1.02), 't': (0.0, 0.86, -0.50), 'e': (0.9, 0.1, -0.1)}, legR=(-44, 2, 6, -30, -50, 0), legL=(62, -4, -6, -70, -24, 0), grip=(1.0, 0.34))),
        (0.34, P(hips=(-4, 4, 0), off=(0.0, 0.04, -0.02), spine=(-4, 2, 0), head=(0, -2, 0), R={'g': (0.12, 0.30, 1.56), 't': (0.0, 0.36, -0.93), 'e': (0.85, -0.2, -0.2)}, grip=(1.0, 0.20))),
        (0.48, P(hips=(-26, 4, 0), off=(0.0, 0.14, -0.20), spine=(-40, 2, 0), head=(24, -2, 0), R={'g': (0.08, 0.46, 0.74), 't': (0.0, 0.26, -0.96), 'e': (0.85, -0.2, -0.2)}, legR=(-34, 2, 6, -40, -44, 0), legL=(56, -4, -6, -78, -22, 0), grip=(1.0, 0.16))),
        (0.77, P())])
    # WATER WHIP. The shoulder leads and the free hand lashes out past it, wrist last.
    C['whip'] = dict(loop=False, drag=0.4, spring=1.3, contact=0.12, keys=[
        (0.00, P()),
        (0.06, free(hips=(2, 26, 0), off=(0.0, -0.03, -0.06), spine=(2, 18, 0), head=(0, -30, 0), R=low, L={'g': (-0.46, -0.16, 1.36), 'e': (-0.7, -0.7, 0.1), 'palm': (-20, 0, 0)})),
        (0.15, free(hips=(-6, -22, 0), off=(0.0, 0.10, -0.04), spine=(-10, -18, 0), head=(4, 26, 0), R=low, L={'g': (-0.12, 0.72, 1.40), 'e': (-0.9, 0.1, -0.3), 'palm': (10, 0, 0)})),
        (0.26, free(hips=(-8, -28, 0), off=(0.0, 0.12, -0.05), spine=(-12, -22, 0), head=(6, 32, 0), R=low, L={'g': (-0.04, 0.70, 1.26), 'e': (-0.9, 0.1, -0.4), 'palm': (30, 0, 0)})),
        (0.53, P())])
    # GEYSER. The shaft stood up and slammed butt first into what's under him; then the free hand sweeps up and the water follows it.
    C['geyser'] = dict(loop=False, drag=0.35, spring=1.3, contact=0.20, keys=[
        (0.00, P()),
        (0.12, free(hips=(2, -10, 0), off=(0.0, -0.02, 0.02), spine=(6, -8, 0), head=(-4, 10, 0), R={'g': (0.32, 0.24, 1.46), 't': (0.02, 0.08, 1.0), 'e': (0.8, -0.3, -0.5)}, L={'g': (-0.36, 0.20, 0.92), 'e': (-0.8, -0.2, -0.5)})),
        (0.21, free(hips=(-12, -4, 0), off=(0.0, 0.04, -0.16), spine=(-14, -2, 0), head=(8, 2, 0), R={'g': (0.30, 0.30, 0.98), 't': (0.02, 0.10, 1.0), 'e': (0.8, -0.3, -0.4)}, L={'g': (-0.32, 0.34, 1.08), 'e': (-0.8, -0.2, -0.4)})),
        (0.36, free(hips=(-14, -2, 0), off=(0.0, 0.03, -0.12), spine=(10, 0, 0), head=(-14, 0, 0), R={'g': (0.30, 0.30, 1.00), 't': (0.02, 0.10, 1.0), 'e': (0.8, -0.3, -0.4)}, L={'g': (-0.24, 0.42, 1.84), 'e': (-0.8, 0.2, 0.1), 'palm': (50, 0, 0)})),
        (0.63, P())])
    # FROST LANCE. Overhand with the free hand: the far shoulder back, the whole left side comes through, the hand opens out in front.
    C['lance_throw'] = dict(limit=950.0, loop=False, drag=0.35, spring=1.3, contact=0.17, keys=[
        (0.00, P()),
        (0.10, free(hips=(4, 32, 0), off=(0.0, -0.05, -0.04), spine=(8, 22, 0), head=(-4, -36, 0), R=low, L={'g': (-0.36, -0.24, 1.62), 'e': (-0.7, -0.6, 0.3), 'palm': (-30, 0, 0)})),
        (0.20, free(hips=(-10, -20, 0), off=(0.0, 0.12, -0.03), spine=(-16, -16, 0), head=(6, 20, 0), R=low, L={'g': (-0.12, 0.70, 1.40), 'e': (-0.9, 0.1, -0.2), 'palm': (24, 0, 0)})),
        (0.30, free(hips=(-12, -24, 0), off=(0.0, 0.12, -0.05), spine=(-20, -18, 0), head=(8, 24, 0), R=low, L={'g': (0.02, 0.56, 1.02), 'e': (-0.9, 0.2, -0.3), 'palm': (10, 0, 0)})),
        (0.57, P())])
    # GLACIER STOMP. The one blow that's in the legs: the right knee comes up with the trident held over the ground, then foot and point go down together.
    feet = dict(legR={'a': (0.125, 0.015, h), 'p': 0, 't': 0}, legL={'a': (-0.145, 0.10, h), 'p': 0, 't': 0})
    stomp_hi = dict(legR={'a': (0.16, 0.20, 0.50), 'p': -10, 't': 0, 'k': (0.1, 1.0, 0.1)}, legL=feet['legL'])
    stomp_lo = dict(legR={'a': (0.16, 0.24, h), 'p': 0, 't': 0, 'k': (0.1, 1.0, 0.1)}, legL=feet['legL'])
    C['glacier_stomp'] = dict(limit=950.0, loop=False, drag=0.3, spring=1.4, contact=0.23, keys=[
        (0.00, dict(P(), **feet)),
        (0.14, dict(P(hips=(6, -8, 0), off=(0.0, -0.03, 0.05), spine=(12, -4, 0), head=(-8, 6, 0), R={'g': (0.30, 0.22, 1.50), 't': (0.04, 0.12, -0.99), 'e': (0.8, -0.3, -0.2)}, L={'g': (-0.18, 0.26, 1.66), 'e': (-0.8, -0.2, 0.0)}, grip=(1.0, 0.14)), **stomp_hi)),
        (0.25, dict(P(hips=(-16, 4, 0), off=(0.0, 0.08, -0.18), spine=(-24, 2, 0), head=(16, -2, 0), R={'g': (0.28, 0.36, 0.86), 't': (0.04, 0.12, -0.99), 'e': (0.8, -0.3, -0.2)}, L={'g': (-0.10, 0.38, 1.02), 'e': (-0.8, -0.2, -0.2)}, grip=(1.0, 0.14)), **stomp_lo)),
        (0.44, dict(P(hips=(-14, 4, 0), off=(0.0, 0.06, -0.16), spine=(-20, 2, 0), head=(12, -2, 0), R={'g': (0.28, 0.36, 0.90), 't': (0.04, 0.12, -0.99), 'e': (0.8, -0.3, -0.2)}, L={'g': (-0.10, 0.38, 1.06), 'e': (-0.8, -0.2, -0.2)}, grip=(1.0, 0.16)), **stomp_lo)),
        (0.73, dict(P(), legR={'a': (0.125, 0.015, h), 'p': 0, 't': 0}, legL=feet['legL']))])
    # THE COLD BREATH. Braced, the palm out at arm's length, held; a slow push against what it's doing.
    brace = dict(hips=(-6, -16, 0), off=(0.0, 0.05, -0.10), spine=(-10, -12, 0), head=(6, 12, 0), R=low, L={'g': (-0.06, 0.62, 1.44), 'e': (-0.9, -0.1, -0.3), 'palm': (66, 0, 0)})
    C['breath_cone'] = dict(loop=False, drag=0.3, spring=1.2, contact=0.13, keys=[
        (0.00, P()), (0.13, free(**brace)), (0.60, free(**dict(brace, off=(0.0, 0.03, -0.11), L={'g': (-0.06, 0.60, 1.42), 'e': (-0.9, -0.1, -0.3), 'palm': (70, 0, 0)}))), (1.03, free(**brace)), (1.20, P())])
    # What the Reavers need, on the same skeleton. The wind-up is held: a person reads it from behind a phone, then the blow comes in 0.1 s.
    cock = dict(hips=(6, -40, 0), off=(0.0, -0.08, -0.06), spine=(4, -26, 0), head=(-6, 54, 0), R={'g': (0.44, -0.26, 1.46), 't': (0.54, 0.30, 0.78), 'e': (0.8, -0.5, 0.0)}, grip=(0.0, 0.3), L={'g': (-0.36, 0.34, 1.20), 'e': (-0.8, -0.2, -0.4)})
    C['tell_slash'] = dict(loop=False, drag=0.3, spring=1.2, blow=0.7, keys=[
        (0.00, P()), (0.26, P(**cock)), (0.84, P(**dict(cock, hips=(7, -44, 0), spine=(5, -30, 0)))),
        (0.95, P(hips=(-8, 40, 0), off=(-0.02, 0.14, -0.05), spine=(-12, 36, 0), head=(4, -46, 0), R={'g': (-0.30, 0.56, 1.24), 't': (-0.78, 0.60, 0.02), 'e': (0.7, 0.2, -0.65)}, grip=(0.0, 0.3), L={'g': (-0.36, 0.20, 1.10), 'e': (-0.8, -0.2, -0.4)})),
        (1.40, P())])
    hi = dict(hips=(8, -6, 0), off=(0.0, -0.05, 0.04), spine=(18, -4, 0), head=(-18, 4, 0), R={'g': (0.12, -0.02, 2.00), 't': (0.0, 0.44, 0.90), 'e': (0.85, 0.0, 0.25)}, grip=(1.0, 0.34))
    C['tell_chop'] = dict(loop=False, drag=0.3, spring=1.2, blow=0.7, keys=[
        (0.00, P()), (0.26, P(**hi)), (0.84, P(**dict(hi, spine=(20, -4, 0)))),
        (0.95, P(hips=(-20, 8, 0), off=(0.0, 0.14, -0.12), spine=(-34, 4, 0), head=(18, -4, 0), R={'g': (0.08, 0.62, 0.98), 't': (0.0, 0.84, -0.54), 'e': (0.9, 0.1, -0.1)}, grip=(1.0, 0.34))),
        (1.40, P())])
    guardS = dict(hips=(-6, -22, 0), off=(0.0, 0.0, -0.10), spine=(-8, -16, 0), head=(10, 22, 0), L={'g': (-0.06, 0.46, 1.32), 'e': (-0.9, -0.1, -0.5), 'palm': (0, 0, 0)}, R={'g': (0.34, -0.06, 1.06), 't': (0.0, 0.96, 0.26), 'e': (0.8, -0.4, -0.4)}, grip=(0.0, 0.3))
    C['shield_guard'] = dict(loop=False, drag=0.3, keys=[(0.00, P()), (0.20, P(**guardS)), (1.00, P(**dict(guardS, off=(0.0, 0.0, -0.11))))])
    C['throw'] = dict(loop=False, drag=0.3, spring=1.3, blow=0.0, keys=[
        (0.00, P(hips=(4, 30, 0), off=(0.0, -0.05, -0.03), spine=(8, 22, 0), head=(-4, -34, 0), R={'g': (0.40, -0.40, 1.56), 't': (0.10, 0.92, 0.30), 'e': (0.8, -0.6, 0.2)}, grip=(0.0, 0.3), L={'g': (-0.38, 0.40, 1.34), 'e': (-0.8, -0.2, -0.3)})),
        (0.15, P(hips=(-10, -20, 0), off=(0.0, 0.12, -0.03), spine=(-16, -16, 0), head=(6, 20, 0), R={'g': (0.14, 0.70, 1.40), 't': (0.02, 0.98, -0.12), 'e': (0.9, 0.1, -0.2)}, grip=(0.0, 0.3), L={'g': (-0.36, 0.02, 1.08), 'e': (-0.8, -0.3, -0.4)})),
        (0.55, P())])
    return C

ARMED = [False]            # True while baking the Reavers: their spear never leaves the hand. The Warden's trident rides on his back out of a fight (web/js/body.js), so his hands are free in everything that isn't a blow
def stagger(ph):
    """Dazed: the head rolls, the arms hang, the weight sways over knees that have nearly gone."""
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a)
    return {'hips': (6 + 2 * c, 4 * s, 3 * s), 'off': (0.03 * s, -0.02, -0.14 + 0.02 * c), 'spine': (20 + 3 * c, -5 * s, 5 * s), 'head': (24, 10 * math.sin(a + 0.8), 14 * s),
            'R': {'g': (0.44, 0.12, 0.86 + 0.02 * c), 't': (0.2, 0.86, -0.46), 'e': (0.8, -0.4, -0.4)}, 'L': {'g': (-0.40, 0.14, 0.84 - 0.02 * c), 'e': (-0.8, -0.3, -0.4), 'palm': (10, 0, 0)},
            'legR': (24, 4, 6, -44, -24, 0), 'legL': (30, -4, -6, -50, -22, 0), 'grip': (0.0, 0.3)}

# ------------------------------------------------------------------ swims: one wave, chest to toes. Phelps under water: the chest starts it, the hips drive,
# the knees bend only to about 60 degrees on the up-beat and snap straight on the down-beat, the feet whip last, the arms stay locked.
def dolphin(ph, amp=1.0, knee=60.0, foot=20.0, chest=1.0, gap=0.03):
    """ph: 0..1. Each segment's tilt in space follows the one above it, later; the turns are the differences. Returns fk, legs, hips, off.
    The order is a real swimmer's. The chest presses first, the hips rise and the thighs start down while the feet are still going up, so the knees bend (never
    past about 60 degrees); then the knees snap straight and the feet whip through last. The legs come back up straight."""
    a = 2 * math.pi * ph
    leads = (2.70, 2.15, 1.55, 1.00)
    A = (4.0 * chest * amp, 5.0 * amp, 7.0 * amp, 9.0 * amp)          # chest, ribs, lumbar, pelvis: tilt in space, degrees
    t_chest, t_ribs, t_lumb, t_pelvis = [A[i] * math.sin(a + leads[i]) for i in range(4)]
    fk = {'spine_3': (t_chest - t_ribs, 0, 0), 'spine_2': (t_ribs - t_lumb, 0, 0), 'spine_1': (t_lumb - t_pelvis, 0, 0)}
    def leg(lag):
        b = a - lag
        thigh = 16.0 * amp * math.sin(b) + 3.0                 # thigh in space: + is the down-beat, towards the belly
        hp = thigh - t_pelvis
        flex = max(0.0, math.cos(b - 0.40)) ** 1.5             # straight on the up-beat; most bend just as the thigh passes its middle going down
        k = -(5.0 + knee * flex)
        ank = -64.0 - foot * math.cos(b - 1.25)                # the water pushes the foot long on the down-beat, last of all
        toe = -8.0 - 14.0 * math.cos(b - 1.9)
        return (hp, k, ank, toe)
    return fk, leg(0.0), leg(gap * 2 * math.pi), t_pelvis, -0.055 * amp * math.cos(a - 0.5)

def swim_slow(ph):
    fk, r, l, tp, y = dolphin(ph, 0.75, knee=44, foot=18)
    a = 2 * math.pi * ph
    s = math.sin(a)
    return {'hips': (tp, 0, 2.5 * math.sin(a * 0.5 * 2)), 'off': (0.0, y, 0.0), 'spine': (0, 0, 0), 'head': (50, 0, 0), 'fk': dict(fk, neck=(22, 0, 0), head=(30, 0, 0)),
            'R': ({'g': (0.33, 0.20, 0.92 + 0.03 * math.sin(a - 1.1)), 't': (0.17, -0.03, 1.0), 'e': (0.8, -0.6, 0.0)} if ARMED[0] else
                  {'g': (0.34, 0.20 - 0.06 * s, 1.20 + 0.11 * math.sin(a + 2.3)), 'e': (0.8, -0.3, 0.2), 'palm': (18 * math.cos(a + 2.3), 0, 0)}),
            'L': {'g': (-0.34, 0.20 + 0.06 * s, 1.20 + 0.11 * math.sin(a - 0.8)), 'e': (-0.8, -0.3, 0.2), 'palm': (18 * math.cos(a - 0.8), 0, 0)},
            'legR': (r[0], 2, 2, r[1], r[2], r[3]), 'legL': (l[0], -2, -2, l[1], l[2], l[3]), 'grip': (0.0, 0.3)}

def streamline(ph, amp, knee, foot, chest, s, neck, hd):
    fk, r, l, tp, y = dolphin(ph, amp, knee=knee, foot=foot, chest=chest)
    base = {'hips': (tp, 0, 0), 'off': (0.0, y, 0.0), 'spine': (0, 0, 0), 'head': (0, 0, 0), 'fk': dict(fk, neck=(neck, 0, 0), head=(hd, 0, 0)),
            'legR': (r[0], 0, 1, r[1], r[2], r[3]), 'legL': (l[0], 0, -1, l[1], l[2], l[3])}
    if ARMED[0]: return dict(base, R={'g': (0.04, 0.05, 0.90), 't': (0.0, 0.0, 1.0), 'e': (0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7}, L={'g': (-0.1, 0.0, 0.8), 'e': (-0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7}, grip=(1.0, s), polL=(0.9, 0.0, 0.1))
    return dict(base, R={'g': (0.08, 0.05, 0.80), 'e': (0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7, 'palm': (0, 0, 0)}, L={'g': (-0.08, 0.05, 0.80), 'e': (-0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.7, 'palm': (0, 0, 0)}, grip=(0.0, 0.3))       # both hands ahead, long

def swim_fast(ph): return streamline(ph, 1.0, 58, 22, 1.0, 0.10, 12, 16)
def boost(ph): return streamline(ph, 1.3, 62, 26, 1.6, 0.13, 6, 10)
def super_swim(ph):
    """48 m/s under water: the whole body one rigid line behind the point, only a tiny fast whip from the hips down, the feet long."""
    return streamline(ph, 0.30, 13, 9, 0.25, 0.13, 3, 4)

def ride_grip(ph):
    """On a whale's back: flat along it, both fists closed on the root of the fin, the trident held along the same line, the legs trailing in a slow kick."""
    fk, r, l, tp, y = dolphin(ph, 0.4, knee=30, foot=14, chest=0.5)
    return {'hips': (tp, 0, 0), 'off': (0.0, y * 0.5, 0.0), 'spine': (0, 0, 0), 'head': (0, 0, 0), 'fk': dict(fk, neck=(26, 0, 0), head=(26, 0, 0)),
            'R': {'g': (0.02, 0.10, 0.73), 'e': (0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.6, 'palm': (0, 0, 0)}, 'L': {'g': (-0.035, 0.10, 0.725), 'e': (-0.9, 0.0, 0.1), 'fr': 'chest', 'ku': 0.6, 'palm': (0, 0, 0)},
            'legR': (r[0], 0, 1, r[1], r[2], r[3]), 'legL': (l[0], 0, -1, l[1], l[2], l[3]), 'grip': (0.0, 0.3)}

def idle_tread(ph):
    """A person resting in the water: leaning a little forward, head level, arms low and easy by his hips with soft elbows, the hands sculling small from the forearm, the legs hanging loose with the knees easing and the toes long. Five seconds, and no two parts keep time."""
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a); s2, c2 = math.sin(2 * a), math.cos(2 * a); s3 = math.sin(3 * a)
    def leg(q, base):
        b = 2 * a + q + 0.4 * s
        return base + 11 * math.sin(b) + 2 * s3, -44 - 17 * math.sin(b + 1.2), -56 - 12 * math.sin(b - 0.8)      # thigh, knee, foot: a slow pedal, the foot following the knee
    r, l = leg(0.0, 30.0), leg(2.2, 22.0)
    def arm(sd, q):
        b = 3 * a + q                                                    # the scull: small, from the forearm, three to the loop
        wx = 0.335 + 0.012 * math.sin(a + q); wy = 0.095 + 0.03 * math.sin(b); wz = 1.005 + 0.012 * math.sin(2 * a + q) + 0.006 * math.cos(b)
        return {'g': (sd * wx, wy, wz), 'e': (sd * 0.22, -0.95, -0.2), 'palm': (10 + 22 * math.sin(b + 0.9), 0, sd * (6 + 8 * math.cos(b + 0.9))), 'ku': 0.12}
    return {'hips': (-5 + 1.6 * math.sin(a + 1.0), 2.5 * s, 2.2 * math.sin(a + 0.9)), 'off': (0.012 * math.sin(a + 0.9), 0.012 * c2, -0.03 + 0.012 * s2),
            'spine': (-3 - 1.6 * math.sin(a + 1.4) + 0.8 * s2, -3 * math.sin(a + 0.3), -2 * math.sin(a + 1.2)),
            'head': (8 + 2 * math.sin(2 * a + 2.0), 8 * math.sin(a + 2.2) + 3 * s3, 1.5 * math.sin(a + 0.4)),
            'R': arm(1, 0.0), 'L': arm(-1, 1.7),
            'legR': (r[0], -5 - 1.5 * s, 4, r[1], r[2], -8), 'legL': (l[0], 5 + 1.5 * s, -4, l[1], l[2], -8), 'grip': (0.0, 0.3)}

def idle_combat(ph):
    """The guard, alive: he breathes and hangs in the water, the point stays on the enemy, the legs turn over slowly to hold him there."""
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a)
    d = dict(GUARD)
    g = GUARD
    d['off'] = (0.0, g['off'][1] + 0.008 * c, g['off'][2] + 0.014 * s)
    d['hips'] = (g['hips'][0] + 1.2 * s, g['hips'][1] + 1.6 * math.sin(a + 1.0), 0.8 * c)
    d['spine'] = (g['spine'][0] - 1.6 * s, g['spine'][1] - 1.2 * math.sin(a + 1.0), 0)
    d['head'] = (g['head'][0] + 0.8 * s, g['head'][1] + 1.2 * math.sin(a + 1.0), 0)
    G = g['R']['g']; T = g['R']['t']
    d['R'] = {'g': (G[0], G[1] + 0.012 * c, G[2] + 0.012 * math.sin(a - 0.4)), 't': (T[0] + 0.012 * c, T[1], T[2] + 0.016 * s), 'e': g['R']['e']}
    lr, ll = g['legR'], g['legL']
    d['legR'] = (lr[0] + 7 * math.sin(a + 0.8), lr[1], lr[2], lr[3] + 12 * math.sin(a), lr[4] + 8 * math.sin(a - 1.0), 0)
    d['legL'] = (ll[0] - 7 * math.sin(a + 0.8), ll[1], ll[2], ll[3] - 12 * math.sin(a), ll[4] - 8 * math.sin(a - 1.0), 0)
    d['grip'] = (1.0, g['grip'][1] + 0.012 * math.sin(a + 2.0))
    return d

# ------------------------------------------------------------------ land. A foot on the ground rolls heel, flat, ball; whichever part is down moves back at exactly
# the speed of the ground under him, so when the code carries him at `speed` nothing slides. In the air it follows a curve between where it left and where it lands.
def pivot(pf, a, df, du):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return pf + df * c - du * s, df * s + du * c

def stance_foot(ph, g, ft):
    t = ph / g['beta']; H = g['land'] - g['v'] * g['T'] * ph
    if t < g['h1']:
        a = g['ps'] * smooth(1 - t / g['h1']); f, u = pivot(H, a, ft['heel'], ft['h'])
    elif t < g['h2']:
        a = 0.0; f, u = H + ft['heel'], ft['h']
    else:
        a = g['po'] * ((t - g['h2']) / (1 - g['h2'])) ** 1.5; f, u = pivot(H + ft['heel'] + ft['ball'], a, -ft['ball'], ft['h'])
    return f, u, a

def foot_cycle(ph, g, ft):
    """(forward, up, pitch) of one ankle at phase ph; 0 is the heel striking."""
    b = g['beta']
    if ph < b:
        f, u, a = stance_foot(ph, g, ft); return f, u, a, (-a if a < 0 else 0.0)
    dp = 0.012
    p0 = stance_foot(b - 1e-4, g, ft); pm = stance_foot(b - dp, g, ft); p1 = stance_foot(0.0, g, ft); pn = stance_foot(dp, g, ft)
    k = dp / (1 - b)
    ts = [-k, 0.0] + [v[0] for v in g['sw']] + [1.0, 1.0 + k]
    vs = [pm, p0] + [v[1:] for v in g['sw']] + [p1, pn]
    f, u, a = cr_v(ts, vs, (ph - b) / (1 - b))
    return f, u, a, 12.0 * math.sin((ph - b) / (1 - b) * math.pi)

WALK = dict(v=1.30, beta=0.60, land=0.30, ps=16, po=-46, h1=0.16, h2=0.50, width=0.085, sw=[(0.25, -0.18, 0.20, -30), (0.55, 0.02, 0.17, -8), (0.80, 0.24, 0.16, 6)])
RUN = dict(v=4.2, beta=0.27, land=0.16, ps=8, po=-60, h1=0.10, h2=0.46, width=0.065, sw=[(0.22, -0.50, 0.40, -72), (0.50, -0.16, 0.50, -42), (0.76, 0.20, 0.36, -6)])
SPRINT = dict(v=8.2, beta=0.23, land=0.16, ps=2, po=-66, h1=0.06, h2=0.40, width=0.05, sw=[(0.22, -0.62, 0.50, -82), (0.50, -0.22, 0.62, -56), (0.78, 0.24, 0.46, -10)])

def gait(sk, ph, g, hipz, hipf, lean, chest, hy, sy, bob, mid, sway, head):
    ft = sk.foot; a = 2 * math.pi * ph
    r = foot_cycle(ph, g, ft); l = foot_cycle((ph + 0.5) % 1.0, g, ft)
    legR = {'a': (g['width'], r[0], r[1]), 'p': r[2], 't': r[3]}; legL = {'a': (-g['width'], l[0], l[1]), 'p': l[2], 't': l[3]}
    z = hipz + bob * math.cos(2 * a - 4 * math.pi * mid)
    yaw = hy * math.cos(a)                                                 # the hip goes forward with its leg
    return {'hips': (lean, yaw, 2.4 * math.cos(a - 2 * math.pi * mid) * (sway / 0.02 if sway else 0.5)), 'off': (sway * math.cos(a - 2 * math.pi * mid), hipf, z),
            'spine': (chest, -sy * math.cos(a), 0.0), 'head': (head - lean - chest, (sy - hy) * math.cos(a), 0.0), 'legR': legR, 'legL': legL, 'grip': (0.0, 0.3)}, math.cos(a)

def walk(sk, ph):
    d, sw = gait(sk, ph, WALK, -0.045, 0.0, -2.0, -2.0, 6, 9, 0.016, 0.30, 0.018, 0.0)
    if ARMED[0]: d['R'] = {'g': (0.31, 0.02 - 0.09 * sw, 0.97 + 0.01 * sw * sw), 't': (0.02, 0.30, 0.95 - 0.03 * sw), 'e': (0.8, -0.35, -0.5), 'fixed': True}      # shaft carried upright, tipped a little ahead
    else: d['R'] = {'g': (0.285, 0.05 - 0.20 * sw, 0.925 + 0.045 * max(-sw, 0.0)), 'e': (0.2, -0.95, -0.2), 'palm': (8, 0, 0), 'ku': 0.12}      # each arm swings against its leg, from the shoulder, the elbow easing as it comes forward
    d['L'] = {'g': (-0.285, 0.05 + 0.20 * sw, 0.925 + 0.045 * max(sw, 0.0)), 'e': (-0.2, -0.95, -0.2), 'palm': (8, 0, 0), 'ku': 0.12}
    return d

def run(sk, ph):
    """A strong run: chest up, a little forward from the ankles, the free arm pumping from the shoulder, the trident carried at the right hip with its tip back."""
    d, sw = gait(sk, ph, RUN, -0.075, -0.05, -6.0, -6.0, 9, 13, -0.024, 0.135, 0.0, 2.0)
    if ARMED[0]: d['R'] = {'g': (0.31, -0.02 - 0.15 * sw, 0.99 + 0.02 * sw), 't': (0.04, -0.30, 0.95 - 0.03 * sw), 'e': (0.8, -0.55, -0.25), 'fixed': True}     # upright, tipped back: from stand to sprint each carry is within 40° of the next, so a blend never spins the fist
    else: d['R'] = {'g': (0.25 + 0.04 * max(-sw, 0.0), 0.03 - 0.30 * sw, 1.13 + 0.13 * max(-sw, 0.0) - 0.05 * max(sw, 0.0)), 'e': (0.6, -0.78, -0.2), 'palm': (0, 0, 0)}
    d['L'] = {'g': (-0.25 - 0.04 * max(sw, 0.0), 0.03 + 0.30 * sw, 1.13 + 0.13 * max(sw, 0.0) - 0.05 * max(-sw, 0.0)), 'e': (-0.6, -0.78, -0.2), 'palm': (0, 0, 0)}
    return d

def sprint(sk, ph):
    """Faster than a man can: the whole body thrown forward over its feet, stride as long as the legs reach, the free arm driving, the trident streaming behind him."""
    d, sw = gait(sk, ph, SPRINT, -0.115, -0.06, -24.0, -20.0, 12, 16, -0.02, 0.11, 0.0, 4.0)
    if ARMED[0]: d['R'] = {'g': (0.34, -0.46 - 0.05 * sw, 1.08 + 0.02 * sw), 't': (0.06, -0.72, 0.69), 'e': (0.8, -0.5, 0.3), 'fixed': True}   # streaming back and up: the carries are within 110° of each other, so they blend
    else: d['R'] = {'g': (0.27, 0.13 - 0.25 * sw, -0.20 + 0.14 * max(-sw, 0.0)), 'e': (0.7, -0.7, -0.1), 'fr': 'chest', 'palm': (0, 0, 0)}
    d['L'] = {'g': (-0.27, 0.13 + 0.25 * sw, -0.20 + 0.14 * max(sw, 0.0)), 'e': (-0.7, -0.7, -0.1), 'fr': 'chest', 'palm': (0, 0, 0)}      # in the chest's frame: he's leaning 44°, and the arm pumps from there
    return d

def surf_pose(sk, c, ph):
    """Riding. Randy, 1 Nov: "the surf needs both hands back and have the guy lean forward", after "The stance during the surf boost is not good and stiff too" and "Look at surfing types". A speed
    stance: the feet stay as the coaches set them (ombe.co, rapturecamps.com: about 80 cm apart, the back foot across the line of travel, the front one 45 degrees toward it, both knees bent), and
    the whole body leans forward over the front foot from the ankles, hips carried ahead of the feet, never hinged at the waist with the seat out; chest low and turned toward the way he's going,
    head up and looking down the line, both arms swept back behind him with soft elbows, the hands trailing. He's never still: the legs pump, the arms answer a beat late. A carve (c: -1 left, the
    heel side, +1 right, the toe side) sinks him and tips him in, the eyes leading."""
    h = sk.foot['h']; a = 2 * math.pi * ph; s = math.sin(a); s2 = math.sin(2 * a); lag = math.sin(a - 0.9); lean = 20.0 * c; pump = 0.03 * s + 0.008 * s2; sink = 0.09 * abs(c)
    return {'hips': (-24 - 2 * s, 40 - 6 * c + 2 * lag, lean * 0.7 + 1.2 * lag), 'off': (0.03 + 0.02 * lag + 0.04 * c, 0.15, -0.27 - sink + pump), 'spine': (-22 + 2 * s - 4 * abs(c), -20 + 6 * c + 2 * lag, lean * 0.5 + 3 - 2 * lag), 'head': (34 - 2 * s, -18 - 10 * c - 1.5 * lag, -lean * 0.5 - 3 + 1.2 * lag),
            'R': {'g': (0.36 + 0.04 * c + 0.02 * lag, -0.46 - 0.03 * s, 0.80 - 0.5 * sink + 0.04 * lag), 'e': (0.75, -0.1, 0.35), 'palm': (-14, 0, 0), 'ku': 0.3},
            'L': {'g': (-0.28 + 0.04 * c - 0.02 * lag, -0.40 + 0.03 * s, 0.84 - 0.5 * sink - 0.04 * lag), 'e': (-0.75, -0.1, 0.35), 'palm': (10, 0, 0), 'ku': 0.3},
            'legR': {'a': (0.05, -0.39, h + 0.02), 'p': 5 * c, 'y': -80, 't': 0, 'k': (0.75, 0.62, 0.1)}, 'legL': {'a': (-0.01, 0.42, h + 0.02), 'p': -5 * c, 'y': -42, 't': 0, 'k': (0.62, 0.75, 0.1)}, 'grip': (0.0, 0.3)}

def surf_stand(sk, ph): return surf_pose(sk, 0.0, ph)
def surf_carve_L(sk, ph): return surf_pose(sk, -1.0, ph)
def surf_carve_R(sk, ph): return surf_pose(sk, 1.0, ph)

def stood(sk, off_z=-0.02):
    h = sk.foot['h']
    return dict(hips=(-1, 5, 1.5), off=(0.03, 0.0, off_z), spine=(1, -3, -1.5), head=(-1, 5, 0),
                R={'g': (0.30, 0.055, 0.935), 'e': (0.2, -0.95, -0.2), 'palm': (10, 0, 0), 'ku': 0.1},
                L={'g': (-0.30, 0.04, 0.925), 'e': (-0.2, -0.95, -0.2), 'palm': (10, 0, 0), 'ku': 0.1},
                legR={'a': (0.125, 0.015, h), 'p': 0, 't': 0}, legL={'a': (-0.145, 0.10, h), 'p': 0, 't': 0}, grip=(0.0, 0.3))

def stand(sk, ph):
    """At ease on land: weight on the right leg, the arms hanging, the elbows soft. Breathing, a slow shift."""
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a); d = stood(sk)
    d['off'] = (0.03 + 0.008 * s, 0.0, -0.02 + 0.004 * math.sin(2 * a)); d['hips'] = (-1, 5 + 0.6 * c, 1.5 + 0.8 * s)
    d['spine'] = (1 + 1.0 * math.sin(2 * a), -3, -1.5 - 0.6 * s); d['head'] = (-1 + 0.5 * math.sin(2 * a), 5 + 2.0 * math.sin(a + 1.0), 0)
    return d

def fall(sk, ph):
    """In the air: arms out for balance, the legs turning over slowly under him, ready for the ground."""
    a = 2 * math.pi * ph; s = math.sin(a)
    return {'hips': (-4, 0, 1.5 * s), 'off': (0.0, 0.0, 0.0), 'spine': (6, 2 * s, 0), 'head': (8, 0, 0),
            'R': {'g': (0.58, 0.10, 1.34 + 0.02 * s), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)},
            'L': {'g': (-0.60, 0.05, 1.40 - 0.02 * s), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)},
            'legR': (24 + 12 * s, 3, 3, -46 - 14 * s, -24, 0), 'legL': (8 - 12 * s, -3, -3, -38 + 14 * s, -28, 0), 'grip': (0.0, 0.3)}

def land_keys(sk):
    h = sk.foot['h']; C = {}
    st = stood(sk)
    st0 = dict(st, off=(0.0, 0.0, -0.05), hips=(-6, 0, 0), spine=(-6, 0, 0), head=(14, 0, 0))
    # The jump. The press is answered at once: 4 frames of a real crouch with the arms going back, the feet leave at `takeoff`, the arms lead the body up, the knees come up under him, then he's falling.
    legs_off = lambda r, l: dict(legR=r, legL=l)
    C['jump'] = dict(loop=False, drag=0.35, spring=1.5, keys=[
        (0.00, dict(st0, hips=(-14, 0, 0), off=(0.0, -0.02, -0.14), spine=(-12, 0, 0), head=(22, 0, 0),
                    R={'g': (0.36, 0.02, 0.96), 't': (0.0, 1.0, 0.1), 'e': (0.8, -0.5, -0.2)}, L={'g': (-0.32, -0.02, 0.90), 'e': (-0.8, -0.5, -0.2), 'palm': (0, 0, 0)},
                    legR={'a': (0.125, 0.015, h + 0.01), 'p': -4, 't': 4}, legL={'a': (-0.145, 0.10, h + 0.01), 'p': -4, 't': 4})),
        (0.07, dict(st0, hips=(-26, 0, 0), off=(0.0, -0.08, -0.28), spine=(-22, 0, 0), head=(30, 0, 0),
                    R={'g': (0.38, -0.30, 0.90), 't': (0.0, 0.94, 0.3), 'e': (0.8, -0.5, 0.0)}, L={'g': (-0.36, -0.30, 0.86), 'e': (-0.8, -0.5, 0.0), 'palm': (0, 0, 0)},
                    legR={'a': (0.125, 0.015, h + 0.02), 'p': -10, 't': 10, 'k': (0.1, 1.0, 0.1)}, legL={'a': (-0.145, 0.10, h + 0.02), 'p': -10, 't': 10, 'k': (-0.1, 1.0, 0.1)})),
        (0.20, dict(st0, hips=(-4, 0, 0), off=(0.0, 0.04, 0.0), spine=(6, 0, 0), head=(-2, 0, 0),
                    R={'g': (0.36, 0.26, 1.60), 't': (0.10, 0.92, -0.38), 'e': (0.9, 0.0, -0.2)}, L={'g': (-0.32, 0.24, 1.70), 'e': (-0.9, 0.0, -0.2), 'palm': (0, 0, 0)},
                    legR={'a': (0.125, -0.02, 0.22), 'p': -62, 't': 30}, legL={'a': (-0.145, 0.04, 0.24), 'p': -62, 't': 30})),
        (0.36, dict(st0, hips=(-2, 0, 0), off=(0.0, 0.0, 0.04), spine=(6, 0, 0), head=(4, 0, 0),
                    R={'g': (0.46, 0.20, 1.50), 't': (0.2, 0.9, 0.35), 'e': (0.8, -0.2, -0.4)}, L={'g': (-0.48, 0.18, 1.52), 'e': (-0.8, -0.2, -0.4), 'palm': (0, 0, 0)},
                    legR={'a': (0.13, 0.10, 0.50), 'p': -30, 't': 6}, legL={'a': (-0.13, -0.10, 0.36), 'p': -44, 't': 6})),
        (0.54, dict(st0, hips=(-4, 0, 0), off=(0.0, 0.0, 0.02), spine=(6, 0, 0), head=(8, 0, 0),
                    R={'g': (0.58, 0.10, 1.34), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)}, L={'g': (-0.60, 0.05, 1.40), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)},
                    legR={'a': (0.13, 0.20, 0.40), 'p': -26, 't': 6}, legL={'a': (-0.13, -0.02, 0.34), 'p': -38, 't': 6}))])
    # The second jump: a kick off nothing, one tucked somersault forward, opening out to fall. Places in the hips' frame, so everything goes round with him.
    tuck = dict(spine=(-34, 0, 0), head=(26, 0, 0), legR=(96, 3, 4, -118, -36, 0), legL=(102, -3, -4, -124, -36, 0),
                R={'g': (0.36, 0.34, 0.30), 't': (0.30, 0.90, 0.30), 'e': (0.8, -0.3, 0.1), 'fr': 'hips'}, L={'g': (-0.30, 0.30, 0.20), 'e': (-0.8, -0.3, 0.1), 'fr': 'hips'}, grip=(0.0, 0.3), off=(0.0, 0.0, 0.0))
    open_ = dict(tuck, spine=(4, 0, 0), head=(6, 0, 0), legR=(16, 3, 3, -40, -30, 0), legL=(30, -3, -3, -54, -30, 0),
                 R={'g': (0.58, 0.10, 1.34), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)}, L={'g': (-0.60, 0.05, 1.40), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)})
    C['jump2'] = dict(loop=False, drag=0.2, spring=0, keys=[
        (0.00, dict(open_, hips=(-8, 0, 0), legR=(30, 3, 3, -70, -40, 0), legL=(10, -3, -3, -30, -50, 0))),
        (0.13, dict(tuck, hips=(-70, 0, 0))), (0.25, dict(tuck, hips=(-170, 0, 0))), (0.36, dict(tuck, hips=(-270, 0, 0))), (0.50, dict(open_, hips=(-352, 0, 0))), (0.64, dict(open_, hips=(-360, 0, 0)))])
    # Off the top of a wave: the knees drive, the arms come up, he's over his feet in the air.
    C['surf_jump'] = dict(loop=False, drag=0.3, spring=1.3, keys=[
        (0.00, dict(st0, hips=(-12, 20, 0), off=(0.0, -0.02, -0.26), spine=(-8, -16, 0), head=(8, -6, 0), R={'g': (0.62, -0.34, 0.86), 't': (0.46, -0.84, -0.28), 'e': (0.8, -0.5, -0.2)}, L={'g': (-0.54, 0.34, 1.26), 'e': (-0.8, -0.2, -0.5), 'palm': (0, 0, 0)},
                    legR=(30, 6, 3, -70, -30, 0), legL=(50, -6, -3, -70, -30, 0))),
        (0.16, dict(st0, hips=(-6, 10, 0), off=(0.0, 0.0, 0.0), spine=(6, -6, 0), head=(0, -2, 0), R={'g': (0.58, 0.0, 1.30), 't': (0.46, 0.60, 0.65), 'e': (0.8, -0.3, -0.3)}, L={'g': (-0.50, 0.20, 1.58), 'e': (-0.8, -0.1, -0.2), 'palm': (0, 0, 0)},
                    legR=(4, 3, 3, -30, -50, 0), legL=(26, -3, -3, -46, -46, 0))),
        (0.50, dict(st0, hips=(-4, 0, 0), off=(0.0, 0.0, 0.02), spine=(6, 0, 0), head=(8, 0, 0), R={'g': (0.58, 0.10, 1.34), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)}, L={'g': (-0.60, 0.05, 1.40), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)},
                    legR=(24, 3, 3, -46, -24, 0), legL=(8, -3, -3, -38, -28, 0)))])
    # The superhero leap off a sprint: one deep drive, the free fist up and leading, the trident streaming behind, the body a straight line, then he reaches for the ground.
    far = dict(st0, hips=(-20, 0, 0), off=(0.0, 0.05, 0.0), spine=(-6, 0, 0), head=(26, 0, 0),
               R={'g': (0.36, -0.42, 1.04), 't': (0.06, -0.72, 0.69), 'e': (0.8, -0.5, 0.3)}, L={'g': (-0.10, 0.44, 2.02), 'e': (-0.8, 0.1, 0.2), 'ku': 0.6},
               legR=(-34, 2, 3, -10, -62, -10), legL=(26, -2, -3, -96, -58, -10))
    C['leap_super'] = dict(loop=False, drag=0.5, spring=1.2, keys=[
        (0.00, dict(far, hips=(-30, 0, 0), off=(0.0, 0.02, -0.26), spine=(-22, 0, 0), head=(30, 0, 0), legR=(40, 2, 3, -100, -22, 0), legL=(66, -2, -3, -108, -18, 0),
                    R={'g': (0.38, -0.28, 0.90), 't': (0.0, 0.94, 0.3), 'e': (0.8, -0.5, 0.0)}, L={'g': (-0.34, -0.26, 0.90), 'e': (-0.8, -0.5, 0.0), 'palm': (0, 0, 0)})),
        (0.24, far), (0.70, dict(far, spine=(-2, 0, 0))),
        (1.10, dict(far, hips=(-6, 0, 0), off=(0.0, 0.0, 0.02), spine=(6, 0, 0), head=(8, 0, 0), R={'g': (0.58, 0.10, 1.34), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)},
                    L={'g': (-0.60, 0.05, 1.40), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)}, legR=(16, 3, 3, -40, -30, 0), legL=(30, -3, -3, -54, -30, 0)))])
    # The landing that takes the fall: one foot far forward, the rear knee nearly to the ground, the free fist down and the trident flung out low, head bowed, and he stays there
    # a beat. Then the head comes up first and he rises through the legs.
    down = dict(hips=(-34, 10, 0), off=(0.0, 0.04, -0.03), spine=(-30, 6, 0), head=(22, -12, 0),
                R={'g': (0.66, 0.16, 0.62), 't': (0.62, 0.74, 0.20), 'e': (0.8, -0.3, 0.1)},
                L={'g': (-0.20, 0.48, 0.14), 'e': (-0.8, 0.1, 0.1), 'palm': (28, 0, 0)},
                legR={'a': (0.15, -0.44, h + 0.07), 'p': -58, 't': 54, 'k': (0.25, 1.0, 0.0)}, legL={'a': (-0.17, 0.34, h), 'p': 0, 't': 0, 'k': (-0.2, 1.0, 0.1)}, grip=(0.0, 0.3))
    C['land'] = dict(loop=False, drag=0.6, spring=1.4, keys=[
        (0.00, dict(down, hips=(-8, 2, 0), off=(0.0, 0.02, -0.04), spine=(-2, 0, 0), head=(8, 0, 0),
                    R={'g': (0.58, 0.10, 1.34), 't': (0.32, 0.92, 0.22), 'e': (0.7, -0.4, -0.5)}, L={'g': (-0.60, 0.05, 1.40), 'e': (-0.7, -0.4, -0.5), 'palm': (0, 0, 0)},
                    legR={'a': (0.15, -0.20, h + 0.05), 'p': -30, 't': 24}, legL={'a': (-0.17, 0.30, h + 0.03), 'p': 12, 't': 0})),
        (0.14, down),
        (0.20, dict(down, off=(0.0, 0.05, -0.03), spine=(-34, 6, 0))),
        (0.42, dict(down, off=(0.0, 0.05, -0.03), spine=(-33, 6, 0), head=(4, -6, 0))),
        (0.68, dict(st, hips=(-10, 6, 1), off=(0.02, 0.01, -0.03), spine=(-10, 0, 0), head=(6, 0, 0),
                    R={'g': (0.38, 0.14, 1.02), 't': (0.04, 0.24, 0.96), 'e': (0.85, -0.2, -0.45)},
                    legR={'a': (0.125, 0.015, h), 'p': 0, 't': 0}, legL={'a': (-0.145, 0.10, h), 'p': 0, 't': 0})),
        (1.00, st)])
    return C

# ------------------------------------------------------------------ the whole set
LOOPS = {'ride_grip': (ride_grip, 60), 'stagger': (stagger, 78), 'idle_tread': (idle_tread, 150), 'idle_combat': (idle_combat, 72), 'swim_slow': (swim_slow, 42), 'swim_fast': (swim_fast, 27), 'boost': (boost, 18), 'super': (super_swim, 10)}
LAND_LOOPS = {'surf_stand': (surf_stand, 48), 'surf_carve_L': (surf_carve_L, 48), 'surf_carve_R': (surf_carve_R, 48), 'stand': (stand, 90), 'walk': (walk, 32, WALK), 'run': (run, 20, RUN), 'sprint': (sprint, 14, SPRINT), 'fall': (fall, 30)}
# what the code needs beside the keys: forward carry in metres, damage shape; hit windows, reach and arc are read off the tip below
GAMEPLAY = {'atk1': dict(lunge=0.9, cancel_after=0.10), 'atk2': dict(lunge=0.5, cancel_after=0.14), 'atk3': dict(lunge=0.8, cancel_after=0.26),
            'atk_dash': dict(lunge=6.0, cancel_after=0.20), 'atk_spin': dict(lunge=0.0, cancel_after=0.16), 'cast_wave': dict(lunge=0.0, cancel_after=0.20),
            'parry': dict(lunge=0.0, cancel_after=0.1), 'leap': dict(lunge=0.0, cancel_after=0.9)}
REAVER_CLIPS = ('idle_combat', 'swim_slow', 'swim_fast', 'atk1', 'atk2', 'hit_front', 'death', 'run', 'tell_slash', 'tell_chop', 'shield_guard', 'throw', 'stagger')
HERO_SKIPS = ('tell_slash', 'tell_chop', 'shield_guard', 'throw', 'stagger')       # the Reavers' own: the Warden's file doesn't carry them

# ------------------------------------------------------------------ motion capture: Microsoft Rocketbox (MIT), the same Bip01 skeleton as the body. Turns only, read through each bone's own rest frame in our body.
# The whole body is the capture's, legs and all; web/js/body.js only keeps a foot that's down from sliding. The files have the hips nailed in place, so mocap_fit.py reads where they really went back from the feet.
CAP = {'walk': 'm_walk_neutral_01', 'run': 'm_run_neutral_01', 'sprint': 'm_run_fast_01'}
CAP_REST = {'stand': ('m_idle_neutral_01', 150, 40)}          # a stretch of a long take, closed on itself over its last frames
def cap_data():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'mocap_land.json')
    return json.load(open(p)) if os.path.exists(p) else None
def cap_turns(m, clip, i):
    v = m[clip]; rest = m['_hero']['restq']; G = {}
    for b, D in v['q'].items():
        if b in rest and D: G[b] = qmul(qmul(tuple(D[i]), tuple(v['restq'][b])), qconj(tuple(rest[b])))
    Q = {}
    for b in KEYED:
        if b not in G: Q[b] = QI; continue
        pa = PARENT[b]; Q[b] = G[b] if pa == 'root' else qmul(qconj(G[pa]), G[b])
    return Q
def cap_feet(sk, Q):
    """His own feet under these turns, hips at rest: heel, ball and how far the foot is pitched from flat (+ toes up), for each side."""
    out = {}
    for s in 'RL':
        P, G = sk.pos['hips'], Q['hips']; P = add(P, qrot(G, sk.off['leg_' + s])); G = qmul(G, Q['leg_' + s])
        P = add(P, qrot(G, sk.off['shin_' + s])); G = qmul(G, Q['shin_' + s]); P = add(P, qrot(G, sk.off['foot_' + s])); G = qmul(G, Q['foot_' + s]); A = P
        B = add(A, qrot(G, sk.off['toe_' + s])); H = add(A, qrot(G, (0.0, sk.foot['heel'], -sk.foot['h']))); f = qrot(G, unit(sk.off['toe_' + s])); f0 = unit(sk.off['toe_' + s])
        out[s] = (H, B, math.degrees(math.asin(clamp(f[2], -1, 1)) - math.asin(clamp(f0[2], -1, 1))))
    return out
def cap_cycle(sk, m, clip):
    """One stride of real motion on his body. Phase 0 is the right foot coming down, which is how the game keeps time. The legs are the capture's; the hips get back the rise, sway and surge the file had taken out."""
    v = m[clip]; N = len(v['q']['hips']) - 1; S = [cap_turns(m, clip, i) for i in range(N)]; ball_c = sk.pos['toe_R'][2]
    F = [cap_feet(sk, q) for q in S]; f = mocap_fit.fit_cycle(F, ball_c)
    # the runner wasn't going straight down the file's axis: turn all of him so the way he went is the way he faces
    fix = qaxis((0.0, 0.0, 1.0), -math.degrees(math.atan2(f['way'][0], -f['way'][1])))
    for q in S: q['hips'] = qmul(fix, q['hips'])
    F = [cap_feet(sk, q) for q in S]; f = mocap_fit.fit_cycle(F, ball_c); i0 = f['win']['R'][0]
    tracks = {b: [] for b in KEYED}; offs = []
    for k in range(N):
        i = (i0 + k) % N; offs.append((f['x'][i], f['y'][i], f['z'][i]))
        for b in KEYED: tracks[b].append(S[i][b])
    for b in KEYED:
        tracks[b].append(tracks[b][0])
        for i in range(1, N + 1):
            if qdot(tracks[b][i - 1], tracks[b][i]) < 0: tracks[b][i] = tuple(-x for x in tracks[b][i])
    offs.append(offs[0]); T = N / FPS
    gait = dict(T=round(T, 4), L=round(f['L'], 4), v=round(f['L'] / T, 3), beta=round((f['win']['R'][1] + f['win']['L'][1]) / (2.0 * N), 4), on_L=round(((f['win']['L'][0] - i0) % N) / float(N), 4))
    return {'n': N, 'q': tracks, 'off': offs, 'gait': gait, 'way': f['way']}
def cap_rest(sk, m, clip, n, fade):
    """A stretch of a long take, closed on itself. Both feet stay where they are: what moves is the body over them."""
    S = [cap_turns(m, clip, i) for i in range(n)]; c = sk.pos['toe_R'][2]; F = [cap_feet(sk, q) for q in S]
    def mid(i, k): return (F[i]['R'][0][k] + F[i]['L'][0][k] + F[i]['R'][1][k] + F[i]['L'][1][k]) / 4.0
    z0 = -min(mocap_fit.sole(F[0]['R'], c), mocap_fit.sole(F[0]['L'], c))
    O = [(mid(0, 0) - mid(i, 0), mid(0, 1) - mid(i, 1), z0 + (mid(0, 2) - mid(i, 2))) for i in range(n)]
    tracks = {b: [] for b in KEYED}; offs = []
    for i in range(n):
        Q = S[i]; o = O[i]
        if i >= n - fade:
            t = (i - (n - fade)) / float(fade); t = t * t * (3 - 2 * t); Q0 = S[i - n + fade]; o0 = O[i - n + fade]
            Q = {b: qslerp(Q[b], tuple(-x for x in Q0[b]) if qdot(Q[b], Q0[b]) < 0 else Q0[b], t) for b in KEYED}; o = tuple(o[k] + (o0[k] - o[k]) * t for k in range(3))
        offs.append(o)
        for b in KEYED: tracks[b].append(Q[b])
    for b in KEYED:
        tracks[b].append(tracks[b][0])
        for i in range(1, n + 1):
            if qdot(tracks[b][i - 1], tracks[b][i]) < 0: tracks[b][i] = tuple(-x for x in tracks[b][i])
    offs.append(offs[0]); return {'n': n, 'q': tracks, 'off': offs}

# swimming: CMU subjects 125 and 126, lying on a stool, read by eye and by how the arms and legs move together. 125_06 a front crawl, 126_06 a butterfly. The body comes up to stand in his own space: the game lays him down
CAP_SWIM = {'swim_slow': ('126_02', 180, 74), 'swim_fast': ('126_02', 180, 74)}        # one full crawl, read by how the motion repeats: 74 frames, a stroke of each arm in it (right at 201, left at 238) and a real flutter kick
HAND_TWIST = 70.0
def limit_twist(tr, ax, most=HAND_TWIST, tap=3):
    """A hand turns about its forearm only so far: its twist is held within that and smoothed round the loop, what it does the other ways is left alone."""
    n = len(tr); sw = []; tw = []
    for q in tr:
        v = (q[1], q[2], q[3]); d = dot(v, ax); a = 2 * math.degrees(math.atan2(d, q[0])); a = (a + 180.0) % 360.0 - 180.0; t = qaxis(ax, a); sw.append(qmul(q, qconj(t))); tw.append(clamp(a, -most, most))
    for i in range(n):
        a = sum(tw[(i + k) % n] for k in range(-tap, tap + 1)) / (2.0 * tap + 1.0); tr[i] = qmul(sw[i], qaxis(ax, a))
def cap_swim(sk, take, start, n, fade=10):
    import mocap_cmu
    S = mocap_cmu.trial(sk, take)[start:start + n + fade]
    def line(q):
        """Feet to head, and which way his chest faces, in the file."""
        P = {'hips': (0.0, 0.0, 0.0)}; G = {'hips': q['hips']}
        for b in ORDER:
            if b in ('root', 'hips'): continue
            pa = PARENT[b]; P[b] = add(P[pa], qrot(G[pa], sk.off[b])); G[b] = qmul(G[pa], q.get(b, QI))
        return sub(P['head'], mul(add(P['foot_R'], P['foot_L']), 0.5)), qrot(G['spine_3'], (0.0, -1.0, 0.0))
    a = [0.0, 0.0, 0.0]; b = [0.0, 0.0, 0.0]
    for q in S[:n]:
        u, f = line(q); a = [a[k] + u[k] for k in range(3)]; b = [b[k] + f[k] for k in range(3)]
    up = unit(tuple(a)); w = 1.0 + up[2]; c = cross(up, (0.0, 0.0, 1.0)); l = math.sqrt(w * w + dot(c, c)) or 1.0; lift_ = (w / l, c[0] / l, c[1] / l, c[2] / l)
    f = qrot(lift_, unit(tuple(b))); fix = qmul(qaxis((0.0, 0.0, 1.0), -math.degrees(math.atan2(f[0], -f[1]))), lift_)
    tracks = {b: [] for b in KEYED}
    for k in range(n):
        Q = S[k]
        if k < fade:
            t = k / float(fade); t = t * t * (3 - 2 * t); Q1 = S[k + n]; Q = {b: qslerp(tuple(-x for x in Q1[b]) if qdot(Q1[b], Q[b]) < 0 else Q1[b], Q[b], t) for b in KEYED}
        for b in KEYED: tracks[b].append(qmul(fix, Q[b]) if b == 'hips' else Q[b])
    # the left wrist's markers are lost in this take: its hand winds a whole turn about the forearm and the arm jumps with it. A crawl is the same stroke each side, half a cycle apart, so the left arm is the right arm's capture, mirrored
    for b in ('clav', 'arm', 'fore', 'hand'):
        src = tracks[b + '_R']; tracks[b + '_L'] = [(src[(k + n // 2) % n][0], src[(k + n // 2) % n][1], -src[(k + n // 2) % n][2], -src[(k + n // 2) % n][3]) for k in range(n)]
    for s in 'RL': limit_twist(tracks['hand_' + s], unit(sk.off['hand_' + s]))
    # the take runs the arms the wrong way round for a body lying on its front (Randy, 1 Nov: "the swimming in the water has the hand motion reversed"): read in the game the hand above his back went toward his feet. Played the other way a hand recovers over the water toward his head and pulls back under him
    for b in KEYED: tracks[b].reverse()
    stops(sk, tracks)
    for b in KEYED:
        tracks[b].append(tracks[b][0])
        for i in range(1, n + 1):
            if qdot(tracks[b][i - 1], tracks[b][i]) < 0: tracks[b][i] = tuple(-x for x in tracks[b][i])
    return {'n': n, 'q': tracks, 'off': [(0.0, 0.0, 0.0)] * (n + 1), 'loop': True, 'miss': 0.0}

# treading water. There's no tread in any take, so the upper body is a real man at rest, the same take as `stand`: his weight, his breathing, the small turns of his head. In the water the arms float out from his sides and the hands scull in and out, which is what holds a body up;
# the legs pedal slowly under him. Three sculls and two turns of the legs to the five-second loop, so no two parts keep time
TREAD_OUT, TREAD_FWD, TREAD_ELBOW, TREAD_SCULL = 21.0, 16.0, 34.0, 15.0
def cap_tread(sk, m, proc, n=150, fade=40):
    up = cap_rest(sk, m, 'm_idle_neutral_01', n, fade); low = ('hips', 'leg_R', 'shin_R', 'foot_R', 'toe_R', 'leg_L', 'shin_L', 'foot_L', 'toe_L'); tracks = {}
    for b in KEYED: tracks[b] = list(proc['q'][b]) if b in low else list(up['q'][b])
    for k in range(n + 1):
        a = 2 * math.pi * (k % n) / n
        for s, sd, q in (('R', 1.0, 0.0), ('L', -1.0, 1.7)):
            b = 3 * a + q; sc = math.sin(b); out = TREAD_OUT + 4.0 * math.sin(a + q); fwd = TREAD_FWD + 3.0 * math.sin(2 * a + q)
            float_ = qmul(qaxis((0.0, 1.0, 0.0), sd * out), qaxis((1.0, 0.0, 0.0), -fwd)); sweep = qaxis((0.0, 0.0, 1.0), sd * TREAD_SCULL * sc)       # the upper arm turns about its own length: the forearm sweeps in and out
            tracks['arm_' + s][k] = qmul(qmul(float_, sweep), tracks['arm_' + s][k])
            h = sk.arm[s]['hinge']; tracks['fore_' + s][k] = qmul(qaxis(h, TREAD_ELBOW + 7.0 * math.sin(b + 0.9)), tracks['fore_' + s][k])
            ax = unit(sk.off['hand_' + s]); tracks['hand_' + s][k] = qmul(tracks['hand_' + s][k], qaxis(ax, sd * 24.0 * math.cos(b)))        # the palm turns with the sweep, leading it
    stops(sk, tracks)
    for b in KEYED:
        for i in range(1, n + 1):
            if qdot(tracks[b][i - 1], tracks[b][i]) < 0: tracks[b][i] = tuple(-x for x in tracks[b][i])
    return {'n': n, 'q': tracks, 'off': proc['off'], 'loop': True, 'miss': 0.0}

# a start and a stop, each with which frames each foot is down, read by eye from the feet in the files
CAP_ONCE = {'run_start': ('m_run_start', {'R': [(0, 8), (14, 20)], 'L': [(0, 16)]}), 'run_stop': ('m_run_stop', {'R': [(0, 3), (14, 39)], 'L': [(6, 13), (24, 39)]}),
            'walk_start': ('m_walk_start', {'R': [(0, 9), (17, 30)], 'L': [(0, 25)]}), 'walk_stop': ('m_walk_stop', {'R': [(0, 8), (21, 61)], 'L': [(7, 23), (31, 61)]})}
def cap_mirror(Q):
    """The same motion off the other foot."""
    out = {}
    for b in KEYED:
        o = (b[:-1] + ('L' if b[-1] == 'R' else 'R')) if b[-2:] in ('_R', '_L') else b
        q = Q.get(o, QI); out[b] = (q[0], q[1], -q[2], -q[3])
    return out
def cap_once(sk, m, clip, win, mirror):
    N = len(m[clip]['q']['hips']); S = [cap_turns(m, clip, i) for i in range(N)]; c0 = sk.pos['toe_R'][2]
    if mirror: S = [cap_mirror(q) for q in S]; win = {'R': win['L'], 'L': win['R']}
    F = [cap_feet(sk, q) for q in S]; on = {s: [any(a <= i < b for a, b in win[s]) for i in range(N)] for s in 'RL'}
    f = mocap_fit.fit_once(F, on, c0); tracks = {b: [] for b in KEYED}
    for i in range(N):
        for b in KEYED:
            q = S[i][b]
            if i and qdot(tracks[b][-1], q) < 0: q = tuple(-x for x in q)
            tracks[b].append(q)
    return {'n': N - 1, 'q': tracks, 'off': [(f['x'][i], 0.0, f['z'][i]) for i in range(N)], 'loop': False, 'miss': 0.0, 'once': {'on': {s: [[round(a / FPS, 4), round(b / FPS, 4)] for a, b in win[s]] for s in 'RL'}, 'v': [round(x, 2) for x in f['v']]}}

FREE_HANDS = ('fall', 'jump', 'jump2', 'surf_jump', 'surf_stand', 'surf_carve_L', 'surf_carve_R', 'leap_super', 'land', 'leap', 'pick_up', 'dodge_water', 'dodge_land')
def no_shaft(d):
    """A pose with nothing in the right hand: g is the wrist, the fist doesn't turn round a shaft, and the left hand isn't on one."""
    R = d.get('R')
    if not R or 't' not in R: return dict(d, grip=(0.0, 0.3)) if d.get('grip', (0, 0))[0] else d
    R = {k: v for k, v in R.items() if k not in ('t', 'fixed')}; R.setdefault('palm', (0, 0, 0))
    return dict(d, R=R, grip=(0.0, 0.3))

def bake(data, names=None):
    sk = Skel(data); ARMED[0] = bool(names); cap = cap_data()
    out = {}
    fights = fight_clips(); fights.update(power_clips(sk))
    keep = lambda name: (name in names) if names else (name not in HERO_SKIPS)
    for name, (fn, n) in LOOPS.items():
        if not keep(name): continue
        c = bake_proc(sk, fn, n); c['loop'] = True; out[name] = c
    for name, spec in list(fights.items()) + list(land_keys(sk).items()):
        if not keep(name): continue
        IK_MISS[0] = 0.0
        if not names and name in FREE_HANDS: spec = dict(spec, keys=[(t, no_shaft(k)) for t, k in spec['keys']])
        c = bake_keys(sk, spec); c['loop'] = False; c['miss'] = IK_MISS[0]; c['contact'] = spec.get('contact'); out[name] = c
    for name, e in LAND_LOOPS.items():
        if not keep(name): continue
        if len(e) > 2: e[2]['T'] = e[1] / FPS
        IK_MISS[0] = 0.0
        if not names and cap and name in CAP: c = cap_cycle(sk, cap, CAP[name]); c['loop'] = True; c['miss'] = 0.0; out[name] = c; continue
        if not names and cap and name in CAP_REST: c = cap_rest(sk, cap, CAP_REST[name][0], CAP_REST[name][1], CAP_REST[name][2]); c['loop'] = True; c['miss'] = 0.0; out[name] = c; continue
        c = bake_proc(sk, (lambda ph, f=e[0], free=(not names and name in FREE_HANDS): (no_shaft(f(sk, ph)) if free else f(sk, ph))), e[1]); c['loop'] = True; c['miss'] = IK_MISS[0]; out[name] = c
    if not names:
        for name, (take, start, n) in CAP_SWIM.items(): out[name] = cap_swim(sk, take, start, n)
        if cap: out['idle_tread'] = cap_tread(sk, cap, out['idle_tread'])
    if not names and cap:
        for name, (clip, win) in CAP_ONCE.items():
            out[name] = cap_once(sk, cap, clip, win, False); out[name + '_m'] = cap_once(sk, cap, clip, win, True)
    return sk, out

def tip_path(sk, c):
    """The trident's point, frame by frame, in the fighter's space (and the grip)."""
    pts = []
    for i in range(c['n'] + 1):
        Q = {b: c['q'][b][i] for b in KEYED}
        Ph = add(sk.pos['hips'], c['off'][i])
        P3, G3 = fk_chain(sk, Q, ['spine_1', 'spine_2', 'spine_3'], Ph, Q['hips'])
        Pc, Gc = fk_chain(sk, Q, ['clav_R', 'arm_R', 'fore_R', 'hand_R'], P3, G3)
        g = add(Pc, qrot(Gc, sk.off['weapon'])); Gw = qmul(Gc, Q['weapon'])
        pts.append(add(g, mul(qrot(Gw, sk.shaft['R']), TIP_LEN)))
    return pts

def meta(sk, clips):
    """moves.json: the windows are read from the point's real speed, not from the keys' times."""
    j = {}
    for name, c in clips.items():
        dur = c['n'] / FPS; e = {'dur': round(dur, 4), 'loop': c['loop'], 'hit': None, 'reach': 0.0, 'arc_deg': 0.0, 'lunge': GAMEPLAY.get(name, {}).get('lunge', 0.0), 'cancel': round(dur, 3)}
        if c.get('gait'): e['gait'] = c['gait']
        if c.get('once'): e['once'] = {'on': c['once']['on']}
        if c.get('blow') is not None:
            first = int(c['blow'] * FPS)
            a, b, peak, sp, pts = blow_window(sk, c, first); top = sp[peak]
            if name == 'atk_spin':
                g = [i for i in range(first, len(sp)) if sp[i] > 0.5 * top]; a, b = g[0], g[-1]
            if name in ('atk1', 'atk_dash', 'cast_wave'):        # a thrust still hurts until it is fully out: the window runs on to the point's furthest reach
                out = [math.hypot(p[0], p[1]) for p in pts]
                b = max(b, max(range(peak, min(peak + 14, len(sp))), key=lambda i: out[i + 1]))
            az = []
            for i in range(a, b + 2):
                p = pts[i]; az.append(math.atan2(-p[0], -p[1]))
            sw = 0.0
            for i in range(1, len(az)):
                d = az[i] - az[i - 1]
                d = (d + math.pi) % (2 * math.pi) - math.pi
                sw += d
            e['hit'] = [round(a / FPS, 3), round((b + 1) / FPS, 3)]
            e['reach'] = round(max(math.hypot(p[0], p[1]) for p in pts[a:b + 2]), 3)
            e['arc_deg'] = round(abs(math.degrees(sw)), 1)
            e['peak_mps'] = round(top, 1); e['contact'] = round(peak / FPS, 3)
            e['cancel'] = round(min(dur, (b + 1) / FPS + GAMEPLAY.get(name, {}).get('cancel_after', 0.12)), 3)
        elif c.get('contact') is not None: e['contact'] = c['contact']
        if c.get('blow') is None and name in GAMEPLAY:
            e['cancel'] = round(GAMEPLAY[name]['cancel_after'], 3) if name != 'leap' else round(dur, 3)
        if name == 'parry': e['guard'] = [0.067, 0.5]
        if name in LAND_LOOPS and len(LAND_LOOPS[name]) > 2: e['speed'] = LAND_LOOPS[name][2]['v']      # the ground speed at which the feet don't slide; scale the clip's rate with the real speed
        if name == 'jump': e['takeoff'] = 0.07                                                             # the feet leave the ground here: start the rise
        if name == 'land': e['stands'] = 0.52                                                              # free to move from here
        j[name] = e
    return j

if __name__ == '__main__':
    data = json.load(open(sys.argv[1]))
    sk, clips = bake(data)
    j = meta(sk, clips)
    if len(sys.argv) > 2: json.dump(j, open(sys.argv[2], 'w'), indent=1)
    for k, v in j.items(): print(k, v)
