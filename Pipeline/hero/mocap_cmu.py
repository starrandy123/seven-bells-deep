# The CMU files, read with no Blender: an ASF skeleton and an AMC motion become turns on his bones, in the same form as moves.cap_turns. Data only. python3 mocap_cmu.py <out.png> <trial> [trial ...] [--at=seconds]
# Axes: in the files x is his left, y up, z forward; in moves.py x is his left, z up, -y forward.
import math, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves
from moves import qmul, qconj, qrot, qaxis, unit, QI
DIR = os.path.join(HERE, 'mocap', 'cmu')
MAP = {'hips': 'root', 'spine_1': 'lowerback', 'spine_2': 'upperback', 'spine_3': 'thorax', 'neck': 'lowerneck', 'head': 'head'}
for s, c in (('R', 'r'), ('L', 'l')):
    MAP.update({'clav_' + s: c + 'clavicle', 'arm_' + s: c + 'humerus', 'fore_' + s: c + 'radius', 'hand_' + s: c + 'hand', 'leg_' + s: c + 'femur', 'shin_' + s: c + 'tibia', 'foot_' + s: c + 'foot', 'toe_' + s: c + 'toes'})
def to_moves_v(v): return (v[0], -v[2], v[1])
def to_moves_q(q): return (q[0], q[1], -q[3], q[2])
def euler(a):
    """Rz Ry Rx, degrees, in the file's axes."""
    return qmul(qaxis((0.0, 0.0, 1.0), a[2]), qmul(qaxis((0.0, 1.0, 0.0), a[1]), qaxis((1.0, 0.0, 0.0), a[0])))
def asf(path):
    bones = {'root': dict(dir=(0.0, 0.0, 0.0), len=0.0, axis=(0.0, 0.0, 0.0), dof=['rx', 'ry', 'rz'])}; kids = {}; mode = None; b = None
    for raw in open(path):
        line = raw.strip()
        if line.startswith(':'): mode = line.split()[0]; continue
        if mode == ':bonedata':
            t = line.split()
            if not t: continue
            if t[0] == 'begin': b = dict(dof=[], axis=(0.0, 0.0, 0.0))
            elif t[0] == 'name': b['name'] = t[1]
            elif t[0] == 'direction': b['dir'] = tuple(float(x) for x in t[1:4])
            elif t[0] == 'length': b['len'] = float(t[1])
            elif t[0] == 'axis': b['axis'] = tuple(float(x) for x in t[1:4])
            elif t[0] == 'dof': b['dof'] = t[1:]
            elif t[0] == 'end': bones[b['name']] = b
        elif mode == ':hierarchy':
            t = line.split()
            if t and t[0] not in ('begin', 'end'): kids[t[0]] = t[1:]
    return bones, kids
def amc(path, step=4):
    frames = []; cur = None; k = -1
    for raw in open(path, errors='ignore'):
        line = raw.strip()
        if not line or line[0] in '#:': continue
        t = line.split()
        if len(t) == 1 and t[0].isdigit():
            k += 1; cur = {} if k % step == 0 else None
            if cur is not None: frames.append(cur)
        elif cur is not None: cur[t[0]] = [float(x) for x in t[1:]]
    return frames
def world(bones, kids, f):
    """Each file bone's turn from its rest, in the file's axes."""
    G = {'root': euler(f['root'][3:6])}
    def walk(n):
        for c in kids.get(n, ()):
            b = bones[c]; v = f.get(c, []); a = [0.0, 0.0, 0.0]
            for d, x in zip(b['dof'], v): a['xyz'.index(d[1])] = x
            C = euler(b['axis']); L = qmul(qmul(C, euler(a)), qconj(C)); G[c] = qmul(G[n], L); walk(c)
    walk('root'); return G
def rest_turns(sk, bones):
    """What takes each of his bones, at his rest, to how the file's skeleton stands at its rest."""
    out = {}
    for b, c in MAP.items():
        kid = next((k for k in moves.ORDER if moves.PARENT.get(k) == b and k in sk.off and (k[:4] not in ('wea', 'cape', 'hair') and k != 'weapon')), None)
        if kid is None or bones[c]['len'] == 0.0 or b in ('hips', 'neck', 'head'): out[b] = QI; continue
        a = unit(sk.off[kid]); d = unit(to_moves_v(bones[c]['dir'])); w = 1.0 + moves.dot(a, d); x = moves.cross(a, d); l = math.sqrt(w * w + moves.dot(x, x)) or 1.0
        out[b] = (w / l, x[0] / l, x[1] / l, x[2] / l)
    return out
def trial(sk, name, step=4):
    subject = name.split('_')[0]; bones, kids = asf(os.path.join(DIR, subject + '.asf')); F = amc(os.path.join(DIR, name + '.amc'), step); A = rest_turns(sk, bones); out = []
    for f in F:
        G0 = world(bones, kids, f); Gh = {b: qmul(to_moves_q(G0.get(c, QI)), A[b]) for b, c in MAP.items()}; Q = {}
        for b in moves.KEYED:
            if b not in Gh: Q[b] = QI; continue
            pa = moves.PARENT[b]
            while pa not in Gh and pa != 'root': pa = moves.PARENT[pa]
            Q[b] = Gh[b] if pa == 'root' else qmul(qconj(Gh[pa]), Gh[b])
        out.append(Q)
    return out
if __name__ == '__main__':
    import json, sticks
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; opt = lambda k, d: float(next((a.split('=')[1] for a in sys.argv if a.startswith('--' + k + '=')), d)); at = opt('at', 6); every = int(opt('every', 4)); out = args[0]; names = args[1:]
    data = json.load(open(os.path.join(HERE, 'out', 'skeleton_hero.json'))); sk = moves.Skel(data); cols = 12; w = sticks.W * cols; h = sticks.H * len(names); px = bytearray(b'\x18\x1c\x24' * (w * h))
    for r, name in enumerate(names):
        S = trial(sk, name); n = len(S); i0 = min(n - 1, int(at * 30)); print(name, n, 'frames', round(n / 30.0, 1), 's')
        for k in range(cols):
            Q = S[min(n - 1, i0 + k * every)]; c = {'q': {b: [Q[b]] for b in moves.KEYED}, 'off': [(0.0, 0.0, 0.0)]}; P = sticks.pose(sk, c, 0); ox = sticks.W * k + sticks.W / 2; oy = r * sticks.H + sticks.H - 40; sc = 56.0
            pt = lambda p: (ox + (-p[1]) * sc, oy - (p[2] - 0.4) * sc)
            for a, b, co in sticks.BONES: sticks.line(px, w, h, pt(P[a]), pt(P[b]), sticks.COL[co])
    sticks.png(out, w, h, px); print(out)
