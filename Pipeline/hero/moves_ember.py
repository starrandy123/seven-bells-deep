# The Emberkin's moves. Plain Python, like moves.py, which it uses and never changes. No capture holds a body on a jet, so the flight is keyed: four poses the game blends by how it's
# really moving (web/js/ember.js). Every blow is capture: CMU subject 14's boxing and subject 135's front kick (mocap_cmu.py). `python3 moves_ember.py <skeleton.json>` runs alone and prints what it cut.
import json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import moves, mocap_cmu
from moves import QI, KEYED, FPS, qdot, qmul, qconj, qrot, qaxis, qslerp, unit, sub, length

def arm(d1, d2, palm=(0, 0, 0)): return {'fr': 'root', 'd1': d1, 'd2': d2, 'palm': palm}
def side(a, s):
    """The same arm on his left."""
    return {'fr': a['fr'], 'd1': (-a['d1'][0], a['d1'][1], a['d1'][2]), 'd2': (-a['d2'][0], a['d2'][1], a['d2'][2]), 'palm': (a['palm'][0], -a['palm'][1], -a['palm'][2])} if s == 'L' else a

# The flight's poses, read off real footage of a suit in flight (film and game frames, the list kept outside this repo) and off skydivers in a full track: "extend from toes to head, keeping the body long and flat".
# Randy, 2 Nov: "The hands motion need to be aligned with the body too and not behind" · "The head must face forward too and not down". The head stays neutral here: the game aims it, by the frame, where he's going (formulas/aim.js).
# (In this rig a positive spine or head goes back and up; a negative one folds forward and down.)
# Hovering: upright, chest proud. The arms stand out from the body about 40° with soft elbows, hands wide of the hips, palms down, so the three jets make a tripod. One knee a little up, the feet close over the one jet.
def fly_hover(sk, ph):
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a); s2 = math.sin(2 * a)
    def hand(k): return arm((0.62, 0.05 + 0.014 * k * s, -0.78), (0.66, 0.20 + 0.02 * k * s, -0.72), (-62, 0, 0))
    return {'hips': (2 + 1.2 * s2, 1.5 * s, 1.0 * c), 'off': (0.0, 0.0, 0.016 * s2), 'spine': (4 + 1.2 * s2, 2 * c, 1.0 * s), 'head': (0, 0, 0), 'R': hand(1), 'L': side(hand(-1), 'L'),
            'legR': (22 + 1.6 * s2, 0, -3.0, -40 - 2 * s2, -44, 0), 'legL': (2 - 1.6 * s2, 0, 3.0, -9 + 2 * s2, -50, 0), 'grip': (0.0, 0.3)}

# At speed he's an arrow: long and straight from the head to the toes (the game lays him along his path). The arms lie along his sides, a little out, in the plane of his body with the hands beside his hips, and the wrists turn the palms back toward his feet. Legs straight, together, toes pointed.
def fly_forward(sk, ph):
    a = 2 * math.pi * ph; s, c = math.sin(a), math.cos(a)
    def hand(k): return arm((0.27, 0.02 + 0.01 * k * s, -0.96), (0.21, 0.05 + 0.012 * k * s, -0.976), (-74, 0, 0))
    return {'hips': (1, 1.2 * s, 1.2 * c), 'off': (0.0, 0.0, 0.0), 'spine': (5 + 1.0 * c, -1.5 * s, 1.2 * s), 'head': (0, 0, 0), 'R': hand(1), 'L': side(hand(-1), 'L'),
            'legR': (-3 + 1.0 * s, 0, -2.4, -4 - 1.0 * s, -64, 0), 'legL': (-2 - 1.0 * s, 0, 2.4, -6 + 1.0 * s, -64, 0), 'grip': (0.0, 0.3)}

# Everything on: the same arrow drawn tighter, arms closer in, palms right back, legs dead straight.
def fly_boost(sk, ph):
    a = 2 * math.pi * ph; s = math.sin(a); j = math.sin(2 * a) * 0.5
    def hand(k): return arm((0.17, 0.0 + 0.006 * k * s, -0.985), (0.13, 0.02, -0.99), (-84, 0, 0))
    return {'hips': (1, 0, 0.8 * s), 'off': (0.0, 0.0, 0.0), 'spine': (6 + j, 0, 0.8 * s), 'head': (0, 0, 0), 'R': hand(1), 'L': side(hand(-1), 'L'),
            'legR': (-3 + 0.5 * s, 0, -1.6, -2, -70, 0), 'legL': (-3 - 0.5 * s, 0, 1.6, -3, -70, 0), 'grip': (0.0, 0.3)}

# Stopping: he rears up, the knees come through and the feet swing ahead of him, palms down and forward, so every jet pushes against the way he's going.
def fly_brake(sk, ph):
    a = 2 * math.pi * ph; s = math.sin(a); c = math.cos(a)
    def hand(k): return arm((0.46, 0.34, -0.82), (0.40, 0.60, -0.69), (-78, 0, 0))
    return {'hips': (8, 1.0 * s, 0), 'off': (0.0, 0.0, 0.0), 'spine': (4 + 1.0 * c, 0, 1.0 * s), 'head': (0, 0, 0), 'R': hand(1), 'L': side(hand(-1), 'L'),
            'legR': (40 + 1.5 * s, 0, -3.0, -48 + 2 * c, -26, 0), 'legL': (28 - 1.5 * s, 0, 3.0, -38 - 2 * c, -30, 0), 'grip': (0.0, 0.3)}

LOOPS = {'fly_hover': (fly_hover, 96), 'fly_forward': (fly_forward, 72), 'fly_boost': (fly_boost, 36), 'fly_brake': (fly_brake, 60)}

# The takeoff, from frames of real launches: he rises upright with the arms out about 45° and the palms down, the feet driving straight down at the ground. The press is answered at once: a short dip at the knees (the anticipation any jump has), the jets take his weight, the legs drive long with the toes pointed, and one knee comes up as the hover takes over.
def launch_keys(sk):
    h = sk.foot['h']; st = moves.stood(sk); fl = dict(legR={'a': (0.125, 0.015, h), 'p': 0, 't': 0}, legL={'a': (-0.145, 0.10, h), 'p': 0, 't': 0})
    def both(a): return dict(R=a, L=side(a, 'L'))
    near = arm((0.34, 0.0, -0.94), (0.36, 0.12, -0.92), (-30, 0, 0)); press = arm((0.54, -0.06, -0.84), (0.60, 0.08, -0.80), (-62, 0, 0)); out = arm((0.70, 0.02, -0.72), (0.74, 0.14, -0.66), (-66, 0, 0))
    k = lambda x: (x, 1.0, 0.1)
    return dict(loop=False, drag=0.3, spring=1.6, keys=[
        (0.00, dict(st, hips=(-5, 0, 0), off=(0.0, -0.01, -0.06), spine=(-3, 0, 0), head=(0, 0, 0), **both(near), legR=dict(fl['legR'], k=k(0.05)), legL=dict(fl['legL'], k=k(-0.05)))),
        (0.13, dict(st, hips=(-18, 0, 0), off=(0.0, -0.05, -0.20), spine=(-11, 0, 0), head=(0, 0, 0), **both(press), legR={'a': (0.125, 0.015, h + 0.01), 'p': -4, 't': 6, 'k': k(0.1)}, legL={'a': (-0.145, 0.10, h + 0.01), 'p': -4, 't': 6, 'k': k(-0.1)})),
        (0.30, dict(st, hips=(3, 0, 0), off=(0.0, 0.0, 0.03), spine=(7, 0, 0), head=(0, 0, 0), **both(out), legR={'a': (0.09, -0.02, 0.15), 'p': -58, 't': 22}, legL={'a': (-0.09, 0.02, 0.15), 'p': -58, 't': 22})),
        (0.56, dict(st, hips=(3, 0, 0), off=(0.0, 0.0, 0.03), spine=(6, 0, 0), head=(0, 0, 0), **both(out), legR={'a': (0.10, 0.12, 0.30), 'p': -48, 't': 12}, legL={'a': (-0.10, -0.02, 0.17), 'p': -54, 't': 14})),
        (0.86, dict(st, hips=(2, 0, 0), off=(0.0, 0.0, 0.02), spine=(4, 0, 0), head=(0, 0, 0), **both(arm((0.62, 0.05, -0.78), (0.66, 0.20, -0.72), (-62, 0, 0))), legR={'a': (0.10, 0.16, 0.38), 'p': -44, 't': 8}, legL={'a': (-0.10, -0.02, 0.16), 'p': -50, 't': 8}))])

# The fire side's martial art comes from the CMU karate forms: real bow and horse stances, long full-extension strikes with a hard stop, as the elemental fighting he asked for is built on Northern Shaolin (Pipeline/research/FIRE_SOURCES.md).
# The blows, as (take, what strikes, seconds of its peak). The file's peak is where the hand or foot moves fastest; the clip runs from before his weight starts to after he's back. Read off a stick sheet, 1 Nov.
BLOWS = {'e_side': ('135_01', 'foot_R', 31.30, 0.62, 0.72), 'e_lunge': ('135_02', 'hand_L', 24.50, 0.50, 0.55), 'e_rev': ('135_02', 'hand_R', 26.87, 0.45, 0.55), 'e_double': ('135_01', 'hand_R', 6.17, 0.55, 0.70), 'e_cross': ('14_03', 'hand_R', 11.87, 0.60, 0.65), 'e_blast': ('14_03', 'hand_R', 20.63, 0.62, 0.55), 'e_hook': ('14_02', 'hand_R', 14.93, 0.55, 0.60), 'e_jab': ('14_02', 'hand_L', 16.50, 0.45, 0.50), 'e_kick': ('135_03', 'foot_R', 1.43, 0.62, 0.78)}
GUARD = ('14_01', 1.4)        # the stillest stretch of a guard in that take is found, then closed on itself

def end_of(sk, Q, bone):
    """Where a hand or a foot is, against his hips, in the fighter's space."""
    chain = {'hand': ['spine_1', 'spine_2', 'spine_3', 'clav_', 'arm_', 'fore_', 'hand_'], 'foot': ['leg_', 'shin_', 'foot_']}[bone[:4]]; s = bone[-1]
    P, G = moves.fk_chain(sk, Q, [c + s if c.endswith('_') else c for c in chain], sk.pos['hips'], QI if False else Q['hips']); return P

def facing(sk, S, a, b, end, peak):
    """The turn that sets a take's blow going straight ahead: what strikes, at its peak, ahead of him. A hand in a take stands wherever the actor faced."""
    p = end_of(sk, S[peak], end); yaw = math.degrees(math.atan2(p[0], -p[1])); return qaxis((0.0, 0.0, 1.0), -yaw)

def cut(sk, S, name):
    take, end, peak_s, before, after = BLOWS[name]; peak = int(peak_s * FPS); a, b = peak - int(before * FPS), peak + int(after * FPS); fix = facing(sk, S, a, b, end, peak)
    tracks = {x: [] for x in KEYED}
    for i in range(a, b + 1):
        for x in KEYED:
            q = S[i].get(x, QI)
            if x == 'hips': q = qmul(fix, q)
            if tracks[x] and qdot(tracks[x][-1], q) < 0: q = tuple(-v for v in q)
            tracks[x].append(q)
    n = b - a; return {'n': n, 'q': tracks, 'off': [(0.0, 0.0, 0.0)] * (n + 1), 'loop': False, 'miss': 0.0, 'contact': round(before, 3), 'strikes': end}

# Getting up off the ground, from CMU subject 140 ("Getting Up From Ground"): a real person from lying flat to standing, so the hips have to travel, which the blows never do. The file's hip height comes with the turns, scaled to his body, measured from where he ends up standing.
UPS = {'up_front': ('140_01', 1.6, 5.1), 'up_back': ('140_09', 1.5, 4.9)}
def get_up(sk, S, name):
    take, a_s, b_s = UPS[name]; a, b = int(a_s * FPS), int(b_s * FPS); F = mocap_cmu.amc(os.path.join(mocap_cmu.DIR, take + '.amc'), 4); U = 0.0254 / 0.45
    q_end = S[b]['hips']; f = qrot(q_end, (0.0, -1.0, 0.0)); fix = qaxis((0.0, 0.0, 1.0), -math.degrees(math.atan2(f[0], -f[1]))); end = F[b]['root']; k = sk.pos['hips'][2] / (end[1] * U)
    tracks = {x: [] for x in KEYED}; off = []
    for i in range(a, b + 1):
        for x in KEYED:
            q = S[i].get(x, QI)
            if x == 'hips': q = qmul(fix, q)
            if tracks[x] and qdot(tracks[x][-1], q) < 0: q = tuple(-v for v in q)
            tracks[x].append(q)
        r = F[i]['root']; d = mocap_cmu.to_moves_v(((r[0] - end[0]) * U * k, (r[1] - end[1]) * U * k, (r[2] - end[2]) * U * k)); off.append(qrot(fix, d))
    return {'n': b - a, 'q': tracks, 'off': off, 'loop': False, 'miss': 0.0}

def still(sk, S, seconds):
    """The stillest stretch of guard: the frames where neither hand moves much, and the hands stay up."""
    n = int(seconds * FPS); P = [(end_of(sk, q, 'hand_R'), end_of(sk, q, 'hand_L')) for q in S]; best, at = 1e9, 0
    for a in range(0, len(S) - n - 1, 3):
        v = sum(length(sub(P[i + 1][0], P[i][0])) + length(sub(P[i + 1][1], P[i][1])) for i in range(a, a + n))
        low = sum(max(0.0, 0.42 - P[i][0][2]) + max(0.0, 0.42 - P[i][1][2]) for i in range(a, a + n, 4))          # hands dropped below the chest isn't a guard
        if v + low * 4 < best: best, at = v + low * 4, a
    return at, n

def guard(sk, S):
    a, n = still(sk, S, GUARD[1]); fade = 12; mid = S[a + n // 2]; p = end_of(sk, mid, 'hand_L'); fix = qaxis((0.0, 0.0, 1.0), -math.degrees(math.atan2(p[0], -p[1])))
    tracks = {x: [] for x in KEYED}
    for k in range(n):
        Q = S[a + k]
        if k < fade:
            t = k / float(fade); t = t * t * (3 - 2 * t); Q1 = S[a + k + n]; Q = {x: qslerp(tuple(-v for v in Q1[x]) if qdot(Q1[x], Q[x]) < 0 else Q1[x], Q[x], t) for x in KEYED}
        for x in KEYED: tracks[x].append(qmul(fix, Q[x]) if x == 'hips' else Q[x])
    for x in KEYED:
        tracks[x].append(tracks[x][0])
        for i in range(1, n + 1):
            if qdot(tracks[x][i - 1], tracks[x][i]) < 0: tracks[x][i] = tuple(-v for v in tracks[x][i])
    return {'n': n, 'q': tracks, 'off': [(0.0, 0.0, 0.0)] * (n + 1), 'loop': True, 'miss': 0.0}

# Clips the Reavers' build already solves on any body: the keyed reactions. The rest of what they need comes from their own list
KEPT = ('hit_front', 'death', 'stagger', 'fall', 'land')

def bake(data):
    sk, out = moves.bake(data, KEPT); moves.ARMED[0] = False
    for name, (fn, n) in LOOPS.items():
        c = moves.bake_proc(sk, (lambda ph, f=fn: f(sk, ph)), n); c['loop'] = True; c['miss'] = 0.0; out[name] = c
    takes = {}
    def take(t):
        if t not in takes: takes[t] = mocap_cmu.trial(sk, t)
        return takes[t]
    for name, b in BLOWS.items(): out[name] = cut(sk, take(b[0]), name)
    out['fly_launch'] = moves.bake_keys(sk, launch_keys(sk)); out['fly_launch'].update(loop=False, miss=0.0)
    out['e_guard'] = guard(sk, take(GUARD[0]))
    for name, u in UPS.items(): out[name] = get_up(sk, take(u[0]), name)
    return sk, out

def meta(clips):
    """What the game reads: each clip's length and, for a blow, when it lands."""
    return {k: {'dur': round(c['n'] / FPS, 4), 'loop': bool(c.get('loop')), **({'contact': c['contact']} if c.get('contact') is not None else {})} for k, c in clips.items()}

if __name__ == '__main__':
    data = json.load(open(sys.argv[1])); sk, clips = bake(data); print(json.dumps(meta(clips)))
